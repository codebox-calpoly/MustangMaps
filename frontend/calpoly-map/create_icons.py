#!/usr/bin/env python3
"""
Create simple icon images for amenities
"""
from PIL import Image, ImageDraw
import os

# Icon configurations: name -> (color, symbol)
ICONS = {
    'water-fountain': ('#2196F3', '💧'),  # Blue
    'bathroom': ('#9C27B0', '🚻'),  # Purple
    'printer': ('#FF9800', '🖨'),  # Orange
    'favorites': ("#F99CBB", '⭐'),  # Pink
    
}

def create_icon(name, color, size=64):
    """Create a simple circular icon with a colored background"""
    # Create image with transparency
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Parse hex color
    if color.startswith('#'):
        color = color[1:]
    r = int(color[0:2], 16)
    g = int(color[2:4], 16)
    b = int(color[4:6], 16)

    # Draw circle with border
    padding = 4
    draw.ellipse(
        [padding, padding, size - padding, size - padding],
        fill=(r, g, b, 255),
        outline=(255, 255, 255, 255),
        width=3
    )

    # Draw inner circle for depth
    inner_padding = size // 4
    lighter_r = min(255, r + 40)
    lighter_g = min(255, g + 40)
    lighter_b = min(255, b + 40)
    draw.ellipse(
        [inner_padding, inner_padding, size - inner_padding, size - inner_padding],
        fill=(lighter_r, lighter_g, lighter_b, 200),
        outline=None
    )

    return img

# Create output directory
output_dir = '/Users/siddharthbalaji/Documents/MustangMaps/frontend/calpoly-map/assets/icons'
os.makedirs(output_dir, exist_ok=True)

# Generate icons
for name, (color, _) in ICONS.items():
    icon = create_icon(name, color, size=64)
    output_path = os.path.join(output_dir, f'{name}.png')
    icon.save(output_path, 'PNG')
    print(f'Created: {output_path}')

print(f'\nCreated {len(ICONS)} icons in {output_dir}')
