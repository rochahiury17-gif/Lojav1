#!/usr/bin/env python3
import sys, os, json, base64, io, textwrap
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def get_font(size):
    font_paths = [
        "/system/fonts/Roboto-Bold.ttf",
        "/system/fonts/DroidSans-Bold.ttf",
        "/data/data/com.termux/files/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"
    ]
    for p in font_paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

def extrair_imagem_pil(data_str):
    if not data_str:
        return None
    try:
        if isinstance(data_str, str) and data_str.strip().startswith("["):
            arr = json.loads(data_str)
            if arr and len(arr) > 0:
                data_str = arr[0]
        if isinstance(data_str, list) and len(data_str) > 0:
            data_str = data_str[0]
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
        print(json.dumps({"error": "Nenhum dado informado"}))
        sys.exit(1)

    arg = sys.argv[1]
    if os.path.exists(arg):
        with open(arg, "r", encoding="utf-8") as f:
            product = json.load(f)
    else:
        product = json.loads(arg)

    # 1. Carrega o template
    bg_path = r"/data/data/com.termux/files/home/loja-online-v1/public/templates/template.png"
    canvas = Image.open(bg_path).convert("RGBA")
    W, H = canvas.size

    # 2. Produto sobre a plataforma
    img_data = product.get("image") or product.get("images")
    prod_img = extrair_imagem_pil(img_data)

    if prod_img:
        # Se for PNG com transparência, corta bordas vazias
        # MACHADO_ALPHA_BBOX_ONLY_V1: ignora RGB escondido em pixels transparentes.
        bbox = prod_img.getchannel("A").getbbox()
        if bbox:
            prod_img = prod_img.crop(bbox)

        # Encaixe no pedestal (máx 360x280)
        prod_img.thumbnail((360, 280), Image.Resampling.LANCZOS)
        pw, ph = prod_img.size

        # Usa a posição escolhida na prévia; sem coordenadas mantém a posição original.
        px = int(product.get("position_x", (W - pw) // 2))
        py = int(product.get("position_y", 750 - ph))
        px = max(0, min(W - pw, px))
        py = max(0, min(H - ph, py))

        # Aplica o tamanho e a rotação escolhidos na prévia.
        centro_x = px + pw / 2
        centro_y = py + ph / 2
        escala = max(0.5, min(1.8, float(product.get("product_scale", 1) or 1)))
        giro = max(-180, min(180, float(product.get("product_rotation", 0) or 0)))
        if escala != 1:
            prod_img = prod_img.resize(
                (max(1, int(pw * escala)), max(1, int(ph * escala))),
                Image.Resampling.LANCZOS
            )
        if giro:
            prod_img = prod_img.rotate(
                -giro, expand=True, resample=Image.Resampling.BICUBIC
            )
        pw, ph = prod_img.size
        px = max(0, min(W - pw, int(centro_x - pw / 2)))
        py = max(0, min(H - ph, int(centro_y - ph / 2)))

        # Sombra de contato
        sw, sh = int(pw * 0.85), max(16, int(ph * 0.12))
        shadow = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
        s_draw = ImageDraw.Draw(shadow)
        s_draw.ellipse([0, 0, sw, sh], fill=(0, 0, 0, 175))
        shadow = shadow.filter(ImageFilter.GaussianBlur(radius=6))
        canvas.paste(shadow, (max(0, min(W - sw, int(px + (pw - sw) / 2))), max(0, min(H - sh, int(py + ph - 8)))), shadow)

        # Cola o produto
        canvas.paste(prod_img, (px, py), prod_img)

    draw = ImageDraw.Draw(canvas)

    # 3. Placa de vidro escuro
    plate_w, plate_h = 860, 175
    plate_x = (W - plate_w) // 2
    plate_y = 815
    plate = Image.new("RGBA", (plate_w, plate_h), (0, 0, 0, 0))
    p_draw = ImageDraw.Draw(plate)
    p_draw.rounded_rectangle([0, 0, plate_w, plate_h], radius=22, fill=(8, 14, 22, 225), outline=(255, 140, 0, 170), width=2)
    canvas.paste(plate, (plate_x, plate_y), plate)

    # 4. Nome
    name = (product.get("name") or "PRODUTO").upper()
    font_title = get_font(34)
    lines = textwrap.wrap(name, width=34)[:2]
    curr_y = plate_y + 16
    for line in lines:
        try:
            bbox = font_title.getbbox(line)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
        except:
            tw, th = 300, 36
        tx = (W - tw) // 2
        draw.text((tx+1, curr_y+2), line, fill=(0,0,0,255), font=font_title)
        draw.text((tx, curr_y), line, fill=(245, 248, 255, 255), font=font_title)
        curr_y += th + 6

    # 5. Badge de Preço
    price_val = product.get("price") or 0
    price_text = f"R$ {float(price_val):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    font_price = get_font(52)
    try:
        p_bbox = font_price.getbbox(price_text)
        pw_box = p_bbox[2] - p_bbox[0]
        ph_box = p_bbox[3] - p_bbox[1]
    except:
        pw_box, ph_box = 240, 50

    badge_w = pw_box + 60
    badge_h = ph_box + 18
    bx = (W - badge_w) // 2
    by = plate_y + plate_h - badge_h - 14

    badge = Image.new("RGBA", (badge_w, badge_h), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(badge)
    b_draw.rounded_rectangle([0, 0, badge_w, badge_h], radius=12, fill=(255, 145, 0, 240), outline=(255, 215, 0, 255), width=2)
    canvas.paste(badge, (bx, by), badge)

    pt_x = (W - pw_box) // 2
    pt_y = by + 6
    draw.text((pt_x, pt_y), price_text, fill=(10, 15, 20, 255), font=font_price)

    # 6. Salva
    out_dir = os.path.join(os.path.dirname(__file__), "..", "public", "posts")
    os.makedirs(out_dir, exist_ok=True)
    out_filename = f"post_{product.get('id', 0)}_{os.getpid()}.png"
    out_path = os.path.join(out_dir, out_filename)
    canvas.save(out_path, "PNG")

    print(json.dumps({"ok": True, "url": f"/posts/{out_filename}", "path": out_path}))

if __name__ == "__main__":
    main()
