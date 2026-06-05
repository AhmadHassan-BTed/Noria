import base64
import os
import re

def main():
    png_path = os.path.join("docs", "images", "noria-logo.png")
    if not os.path.exists(png_path):
        print(f"[Error] PNG logo not found at: {png_path}")
        return

    with open(png_path, "rb") as f:
        b64_content = base64.b64encode(f.read()).decode("utf-8")

    styles_path = os.path.join("ui", "styles.py")
    if not os.path.exists(styles_path):
        print(f"[Error] styles.py not found at: {styles_path}")
        return

    with open(styles_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Regex to find LOGO_BASE64 = "..." and replace it
    pattern = r'(LOGO_BASE64\s*=\s*")[^"]*(")'
    if re.search(pattern, content):
        content = re.sub(pattern, rf'\g<1>{b64_content}\g<2>', content)
        with open(styles_path, "w", encoding="utf-8") as f:
            f.write(content)
        print("[Success] Updated base64 logo in ui/styles.py")
    else:
        # Fallback if first time
        old_target = """def apply_custom_styles():
    # Streamlit Page Config & Custom Styling (WhatsApp Dark Theme)
    import os
    logo_path = os.path.join(os.path.dirname(__file__), "logo.svg")

    st.set_page_config(
        page_title="Noria — Control Center",
        page_icon=logo_path,"""

        new_target = f"""def apply_custom_styles():
    # Streamlit Page Config & Custom Styling (WhatsApp Dark Theme)
    import base64
    from io import BytesIO
    from PIL import Image

    # Base64 encoded self-contained noria-logo.png
    LOGO_BASE64 = "{b64_content}"
    logo_img = Image.open(BytesIO(base64.b64decode(LOGO_BASE64)))

    st.set_page_config(
        page_title="Noria — Control Center",
        page_icon=logo_img,"""

        if old_target in content:
            content = content.replace(old_target, new_target)
            with open(styles_path, "w", encoding="utf-8") as f:
                f.write(content)
            print("[Success] Embedded base64 logo into ui/styles.py (Fallback)")
        else:
            print("[Error] Could not find the expected target structure in ui/styles.py")

if __name__ == "__main__":
    main()
