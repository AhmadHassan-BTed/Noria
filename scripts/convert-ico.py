import os
from PIL import Image

def main():
    png_path = os.path.join("docs", "images", "noria-logo.png")
    ico_path = os.path.join("docs", "images", "noria-logo.ico")

    if os.path.exists(png_path):
        img = Image.open(png_path).convert("RGBA")
        # Save as ICO with strict standard sizes for Windows
        img.save(
            ico_path, 
            format="ICO", 
            sizes=[(16, 16), (32, 32), (48, 48), (256, 256)]
        )
        print(f"[Success] Converted PNG to ICO: {ico_path}")
    else:
        print(f"[Error] PNG file not found at: {png_path}")

if __name__ == "__main__":
    main()
