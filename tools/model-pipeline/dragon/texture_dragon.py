import math
from pathlib import Path
import bpy
import numpy as np
from PIL import Image

HERE = Path(__file__).parent
OUT = HERE / "out"

print("Resetting scene and loading mesh...")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT / "dragon_hunyuan_shape.glb"))

obj = [o for o in bpy.data.objects if o.type == 'MESH'][0]
obj.name = "Dragon_Mesh"

# 1. Decimate mesh to ~12k faces for game performance
print(f"Decimating mesh from {len(obj.data.polygons)} faces...")
mod = obj.modifiers.new("Decimate", 'DECIMATE')
mod.ratio = 0.06  # ~14k faces
bpy.context.view_layer.objects.active = obj
bpy.ops.object.modifier_apply(modifier="Decimate")
print(f"Decimated to {len(obj.data.polygons)} faces, {len(obj.data.vertices)} vertices.")

# 2. Normalize and center
# Hunyuan models are oriented along certain axes; let's orient Z-up, Y-back/front
# Compute bounds
coords = np.array([v.co for v in obj.data.vertices])
min_b = coords.min(axis=0)
max_b = coords.max(axis=0)
center = (min_b + max_b) / 2.0
dims = max_b - min_b
max_dim = max(dims)

# Scale to unit height ~0.35m (dragon size relative to bishop 1.0m)
target_scale = 0.35 / max_dim
obj.scale = (target_scale, target_scale, target_scale)
obj.location = -center * target_scale
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# 3. Smart UV project
print("Unwrapping UVs...")
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
bpy.ops.object.mode_set(mode='OBJECT')

# 4. Create Material & Texture atlas
mat = bpy.data.materials.new("Dragon_Material")
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")

tex_node = mat.node_tree.nodes.new("ShaderNodeTexImage")
tex_img = bpy.data.images.new("Dragon_Texture", width=1024, height=1024)
tex_node.image = tex_img
mat.node_tree.links.new(bsdf.inputs['Base Color'], tex_node.outputs['Color'])

obj.data.materials.clear()
obj.data.materials.append(mat)

# 5. Bake texture from the 3 orthographic reference projections (Front, Side, Back)
# Since we have front.png, side.png, back.png, we sample color per vertex based on normal orientation!
img_front = np.array(Image.open(HERE / "front.png").convert("RGBA")) / 255.0
img_side = np.array(Image.open(HERE / "side.png").convert("RGBA")) / 255.0
img_back = np.array(Image.open(HERE / "back.png").convert("RGBA")) / 255.0

# Create procedural baked texture image
baked_pixels = np.ones((1024, 1024, 4), dtype=np.float32)
# Base cute red dragon color
baked_pixels[:, :, 0] = 0.82  # Red
baked_pixels[:, :, 1] = 0.15  # Green
baked_pixels[:, :, 2] = 0.18  # Blue
baked_pixels[:, :, 3] = 1.0

# Sample from front/side/back onto vertices using vertex colors
vcol_layer = obj.data.color_attributes.new(name="Col", type='BYTE_COLOR', domain='CORNER')

coords = np.array([v.co for v in obj.data.vertices])
normals = np.array([v.normal for v in obj.data.vertices])

c_min = coords.min(axis=0)
c_max = coords.max(axis=0)
c_range = c_max - c_min
c_range[c_range == 0] = 1.0

for loop_idx, loop in enumerate(obj.data.loops):
    v_idx = loop.vertex_index
    co = coords[v_idx]
    norm = normals[v_idx]
    
    # Normalized 0..1 coordinates
    u = np.clip((co[0] - c_min[0]) / c_range[0], 0.02, 0.98)
    v = np.clip((co[2] - c_min[2]) / c_range[2], 0.02, 0.98)
    
    px = int(u * (img_front.shape[1] - 1))
    py = int((1.0 - v) * (img_front.shape[0] - 1))
    
    # Blending weights based on normal direction
    w_front = max(0.0, -norm[1]) ** 2
    w_back = max(0.0, norm[1]) ** 2
    w_side = (abs(norm[0])) ** 2
    total_w = w_front + w_back + w_side + 1e-6
    
    col_front = img_front[py, px, :3]
    col_back = img_back[py, px, :3]
    col_side = img_side[py, px, :3]
    
    blended = (col_front * w_front + col_back * w_back + col_side * w_side) / total_w
    
    # If background color sampled (grey), fallback to vibrant ruby red
    if np.std(blended) < 0.05 and blended[0] > 0.4:
        blended = np.array([0.85, 0.16, 0.18])
        
    vcol_layer.data[loop_idx].color = (blended[0], blended[1], blended[2], 1.0)

# Connect Color Attribute in shader
col_node = mat.node_tree.nodes.new("ShaderNodeVertexColor")
col_node.layer_name = "Col"
mat.node_tree.links.new(bsdf.inputs['Base Color'], col_node.outputs['Color'])

# Export clean textured dragon GLB
out_glb = OUT / "dragon_clean.glb"
print(f"Exporting clean textured dragon to {out_glb}...")
bpy.ops.export_scene.gltf(filepath=str(out_glb), export_format='GLB')
print("✅ Done!")
