#!/usr/bin/env python3
import sys, os, json, base64, io, uuid, urllib.request, sqlite3
from PIL import Image

def extrair_pil(data_str):
    if not data_str:
        return None
    try:
        if isinstance(data_str, str) and data_str.strip().startswith("["):
            arr = json.loads(data_str)
            if arr: data_str = arr[0]
        if "base64," in data_str:
            data_str = data_str.split("base64,")[1]
        if os.path.exists(data_str):
            return Image.open(data_str).convert("RGBA")
        raw = base64.b64decode(data_str)
        return Image.open(io.BytesIO(raw)).convert("RGBA")
    except Exception:
        return None

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "ID do produto necessário"}))
        sys.exit(1)

    prod_id = sys.argv[1]

    # Localiza banco sqlite
    db_file = "loja.sqlite"
    for cand in ["loja.sqlite", "data/loja.sqlite", "loja.db"]:
        if os.path.exists(cand):
            db_file = cand
            break

    conn = sqlite3.connect(db_file)
    cur = conn.cursor()
    cur.execute("SELECT image, images FROM products WHERE id=?", (prod_id,))
    row = cur.fetchone()
    if not row:
        print(json.dumps({"ok": False, "error": "Produto não encontrado"}))
        return

    raw_img = row[0] or row[1]
    img = extrair_pil(raw_img)
    if not img:
        print(json.dumps({"ok": False, "error": "Imagem não encontrada"}))
        return

    # Envia para a API de recorte
    buf_in = io.BytesIO()
    temp_img = img.copy()
    temp_img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    temp_img.convert("RGB").save(buf_in, format="JPEG", quality=90)
    img_bytes = buf_in.getvalue()

    boundary = uuid.uuid4().hex
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="image"; filename="prod.jpg"\r\n'
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode("utf-8") + img_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        "https://clearbackdrop.com/api/v1/remove-background",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "User-Agent": "Mozilla/5.0"}
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            out_bytes = resp.read()
            if len(out_bytes) > 1000:
                cut_img = Image.open(io.BytesIO(out_bytes)).convert("RGBA")
                
                # Salva em pasta pública
                os.makedirs("public/uploads", exist_ok=True)
                cut_filename = f"prod_cut_{prod_id}_{os.getpid()}.png"
                cut_path = os.path.join("public", "uploads", cut_filename)
                cut_img.save(cut_path, "PNG")

                rel_url = f"/uploads/{cut_filename}"

                # Atualiza no banco
                cur.execute("UPDATE products SET image=? WHERE id=?", (rel_url, prod_id))
                conn.commit()

                print(json.dumps({"ok": True, "url": rel_url, "message": "Fundo removido e produto atualizado!"}))
                return
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"Falha na API: {str(e)}"}))
        return

    print(json.dumps({"ok": False, "error": "Resposta inválida da API"}))

if __name__ == "__main__":
    main()
