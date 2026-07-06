import os
from PIL import Image

def compile_images_to_pdf(image_folder, output_pdf_name):
    # Supported image extensions
    valid_extensions = ('.jpg', '.jpeg', '.png', '.bmp', '.tiff')
    
    # 1. Gather and sort the images
    # We use a custom sorting key so 'Slide_2' comes before 'Slide_10' 
    # and handles both 2-digit and 3-digit padding perfectly.
    try:
        images = []
        file_list = os.listdir(image_folder)
        
        # Filter for files that start with 'Slide_' and have valid extensions
        slide_files = [f for f in file_list if f.startswith('Slide_') and f.lower().endswith(valid_extensions)]
        
        if not slide_files:
            print("No images matching 'Slide_' were found in the specified folder.")
            return

        # Sort naturally by extracting the number from 'Slide_XXX'
        slide_files.sort(key=lambda x: int(''.join(filter(str.isdigit, x))))
        
        # 2. Open images and convert them to RGB (required for PDF saving)
        image_list = []
        for file in slide_files:
            file_path = os.path.join(image_folder, file)
            img = Image.open(file_path)
            # Pillow requires RGB mode to save as PDF (especially if it's a PNG with alpha channel)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            image_list.append(img)
            
        # 3. Save as a single PDF
        # We take the first image and append the rest
        first_image = image_list[0]
        rest_of_images = image_list[1:]
        
        first_image.save(output_pdf_name, save_all=True, append_images=rest_of_images)
        print(f"Successfully compiled {len(image_list)} slides into '{output_pdf_name}'!")
        
    except Exception as e:
        print(f"An error occurred: {e}")

# --- Configuration ---
# Use "." if the script is running in the exact same folder as your slides
# Or provide the full path like "C:/Users/Name/Documents/Slides"
FOLDER_PATH = "."  
OUTPUT_PDF = "Compiled_Slides.pdf"

if __name__ == "__main__":
    compile_images_to_pdf(FOLDER_PATH, OUTPUT_PDF)