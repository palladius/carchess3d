import math
from pathlib import Path
import bpy
import numpy as np
from PIL import Image

HERE = Path(__file__).parent
OUT = HERE / "out"
OUT.mkdir(parents=True, exist_ok=True)

print("Resetting scene and loading mesh...")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT / "dragon_hunyuan_shape.glb"))

obj = [o for o in bpy.data.objects if o.type == 'MESH'][0]
obj.name = "Dragon_Mesh"

# 1. Decimate mesh to ~12k faces for game performance
print(f"Decimating mesh from {len(obj.data.polygons)} faces...")
mod = obj.modifiers.new("Decimate", 'DECIMATE')
mod.ratio = 0.06
bpy.context.view_layer.objects.active = obj
bpy.ops.object.modifier_apply(modifier="Decimate")
print(f"Decimated to {len(obj.data.polygons)} faces, {len(obj.data.vertices)} vertices.")

# 2. Normalize and center
coords = np.array([v.co for v in obj.data.vertices])
min_b = coords.min(axis=0)
max_b = coords.max(axis=0)
center = (min_b + max_b) / 2.0
dims = max_b - min_b
max_dim = max(dims)

target_scale = 0.35 / max_dim
obj.scale = (target_scale, target_scale, target_scale)
obj.location = -center * target_scale
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# 3. Create Material
mat = bpy.data.materials.new("Dragon_Material")
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
bsdf.inputs['Roughness'].default_value = 0.35
bsdf.inputs['Metallic'].default_value = 0.05

obj.data.materials.clear()
obj.data.materials.append(mat)

# 4. Color the dragon per concept art:
# - Ruby-red scales (0.95, 0.08, 0.10)
# - Pale lime-green underbelly (0.72, 0.88, 0.22)
# - Dark burgundy horns/spines (0.45, 0.05, 0.08)
# - Emerald green eyes (0.05, 0.85, 0.30)
vcol_layer = obj.data.color_attributes.new(name="Col", type='BYTE_COLOR', domain='CORNER')

coords = np.array([v.co for v in obj.data.vertices])
normals = np.array([v.normal for v in obj.data.vertices])

c_min = coords.min(axis=0)
c_max = coords.max(axis=0)

RUBY_RED = np.array([0.92, 0.08, 0.12])
LIME_GREEN = np.array([0.72, 0.88, 0.22])
BURGUNDY = np.array([0.45, 0.05, 0.08])
EMERALD = np.array([0.05, 0.85, 0.30])

for loop_idx, loop in enumerate(obj.data.loops):
    v_idx = loop.vertex_index
    co = coords[v_idx]
    norm = normals[v_idx]
    
    # Belly / chest area: facing forward/down in front torso
    is_belly = (co[1] < -0.01) and (co[2] < 0.04) and (abs(co[0]) < 0.045) and (norm[1] < -0.15)
    
    # Eye sockets / pupils: front head
    is_eye = (co[2] > 0.05) and (co[1] < -0.06) and (0.015 < abs(co[0]) < 0.045)
    
    # Horns / crown tips: top rear of head
    is_horn = (co[2] > 0.08) and (co[1] > -0.04) and (norm[2] > 0.4)
    
    # Wing underside: facing down on wings
    is_wing_under = (abs(co[0]) > 0.07) and (norm[2] < -0.2)
    
    if is_eye:
        color = EMERALD
    elif is_horn:
        color = BURGUNDY
    elif is_belly or is_wing_under:
        color = LIME_GREEN
    else:
        color = RUBY_RED
        
    vcol_layer.data[loop_idx].color = (float(color[0]), float(color[1]), float(color[2]), 1.0)

# Connect Color Attribute in shader
col_node = mat.node_tree.nodes.new("ShaderNodeVertexColor")
col_node.layer_name = "Col"
mat.node_tree.links.new(bsdf.inputs['Base Color'], col_node.outputs['Color'])

# Export clean textured dragon GLB
out_glb = OUT / "dragon_clean.glb"
print(f"Exporting clean textured dragon to {out_glb}...")
bpy.ops.export_scene.gltf(filepath=str(out_glb), export_format='GLB')
print("✅ Done!")
