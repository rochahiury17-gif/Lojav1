with open("public/app.js", "r") as f:
    code = f.read()

# Ajusta o CSS dos inputs do painel para o texto ficar legível
if "admin-config-fix" not in code:
    css_fix = """
<style id="admin-config-fix">
.config-form input, .config-form textarea, .config-form select {
    color: #ffffff !important;
    background-color: rgba(255, 255, 255, 0.05) !important;
}
</style>
"""
    code = code.replace("function adminConfig()", css_fix + "\nfunction adminConfig()")
    with open("public/app.js", "w") as f:
        f.write(code)
    print("Correção de estilo aplicada!")
else:
    print("Estilo já aplicado.")
