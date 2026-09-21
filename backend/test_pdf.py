import fitz  # PyMuPDF

path = r"D:\full\path\to\your\data-science.pdf"  # 👈 change this

doc = fitz.open(path)
print(f"Total pages: {len(doc)}")
print("=" * 60)

for i, page in enumerate(doc):
    text = page.get_text("text")
    print(f"\n--- PAGE {i+1} ({len(text)} chars) ---")
    print(text[:600])
    if i >= 2:
        break

doc.close()