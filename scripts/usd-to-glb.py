# SimReady model (.usd/.usda) -> public/assets/<name>.glb, sized for the web. All CC BY 4.0.
# Usage: blender -b --factory-startup --disable-autoexec --python scripts/usd-to-glb.py -- "<model>.usd" public/assets/<name>.glb <keep> [up|down] [open] [flaps]
#   keep: the share of triangles kept. up / down: stand it on end, its long side vertical and its wide end up (or down).
#   open: cut away the lid, the upward faces in the top 15% (a scanned cup is a closed shell); its material is two-sided, so the inside shows
#   flaps: fold a box's top flaps out and down over its walls
#   box.glb         ForgeCAD shipping_box                 keep 1 flaps (cutting its flat boards breaks the shading)
#   clock.glb       Palatial D00913                       keep .05 (a 99k-triangle scan; rack.js covers its dial, which has the hands painted on)
#   cup.glb         Palatial D00842                       keep .04 open (a 472k-triangle scan; .01 tears its texture)
#   tube.glb        NVIDIA paint_container_tube_d01       keep .1 up (cap down)
#   spraycan.glb    NVIDIA paint_container_spraycan_a01   keep .3
#   paintbrush-1..3 NVIDIA paint_supplies_brush_a04, a09, a12   keep 1 up (bristles up; ~0.5 MB each: the bristles are
#                   thousands of loose cards a cut cannot shrink, so a cut eats the handle instead. ponytail: thin the cards if size matters)
import bpy, bmesh, sys
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
src, out, keep = args[:3]
for o in list(bpy.data.objects): bpy.data.objects.remove(o)   # the factory scene's cube, camera and light
bpy.ops.wm.usd_import(filepath=src)

for m in bpy.data.materials:
    if not m.node_tree: continue
    imgs = [n.image for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image]
    alb = next((i for i in imgs if '_tile_alb' in i.name), None)
    if alb:   # NVIDIA's plain plastic tiles: their average colour reads the same at this size, for no image bytes
        alb.scale(8, 8); px = alb.pixels[:]
        col = tuple((sum(px[i::4]) / 64) ** 2.2 for i in range(3)) + (1,)   # pixels are sRGB, Base Color is linear
        m.node_tree.nodes.clear()
        bsdf = m.node_tree.nodes.new('ShaderNodeBsdfPrincipled'); bsdf.inputs['Base Color'].default_value = col; bsdf.inputs['Roughness'].default_value = .45
        m.node_tree.links.new(bsdf.outputs[0], m.node_tree.nodes.new('ShaderNodeOutputMaterial').inputs[0])
    else:     # real pictures (labels, cardboard, paint): keep them at 512 px; normal maps cost more bytes than they show at this size
        for n in [n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image]:
            if '_nor' in n.image.name or 'normal' in n.image.name.lower(): m.node_tree.nodes.remove(n)
            elif max(n.image.size) > 512: n.image.scale(512, 512)

# The import links each mesh into two collections and the exporter writes it once per collection: one link each,
# no parents (keeping where they are), and none of SimReady's empty physics / grasp helpers
bpy.context.view_layer.update()
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for o in meshes:
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    for c in list(o.users_collection): c.objects.unlink(o)
    bpy.context.scene.collection.objects.link(o)
for o in [o for o in bpy.data.objects if o.type != 'MESH']: bpy.data.objects.remove(o)
bpy.context.view_layer.update()

flags = args[3:]
if 'up' in flags or 'down' in flags:   # stand it on end: the longest side to +Z, the end with the wider cross-section up (or down)
    pts = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    lo, hi = [Vector([f(p[i] for p in pts) for i in range(3)]) for f in (min, max)]
    ax = max(range(3), key=lambda i: hi[i] - lo[i]); cut = (hi[ax] - lo[ax]) * .15
    def width(q): return sum(max(p[i] for p in q) - min(p[i] for p in q) for i in range(3) if i != ax)
    wide_hi = width([p for p in pts if p[ax] > hi[ax] - cut]) > width([p for p in pts if p[ax] < lo[ax] + cut])
    end = Vector([float(i == ax) for i in range(3)]) * (1 if wide_hi == ('up' in flags) else -1)
    turn = end.rotation_difference(Vector((0, 0, 1))).to_matrix().to_4x4()
    for o in [o for o in bpy.data.objects if not o.parent]: o.matrix_world = turn @ o.matrix_world
    bpy.context.view_layer.update()

if 'open' in flags:
    top = max((o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices)
    low = min((o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices)
    for o in meshes:
        bm = bmesh.new(); bm.from_mesh(o.data); n3 = o.matrix_world.to_3x3()
        lid = [f for f in bm.faces if (n3 @ f.normal).normalized().z > .7 and (o.matrix_world @ f.calc_center_median()).z > top - (top - low) * .15]
        bmesh.ops.delete(bm, geom=lid, context='FACES'); bm.to_mesh(o.data); bm.free()
        for m in o.data.materials: m.use_backface_culling = False

if 'flaps' in flags:   # a box's top flaps (the thin boards above the body) fold out and down, hanging on the outside of its walls
    from mathutils import Matrix
    import math
    pts = lambda o: [o.matrix_world @ v.co for v in o.data.vertices]
    def size(o): p = pts(o); return Vector([max(q[i] for q in p) - min(q[i] for q in p) for i in range(3)])
    body = max(meshes, key=lambda o: size(o).x * size(o).y * size(o).z)   # the box itself: the biggest bounding box
    bp = pts(body); rim = max(p.z for p in bp); mid = Vector([(min(q[i] for q in bp) + max(q[i] for q in bp)) / 2 for i in range(3)])   # bbox centre: its vertices are uneven
    tip = rim
    for o in meshes:
        p = pts(o); lo = Vector([min(q[i] for q in p) for i in range(3)]); hi = Vector([max(q[i] for q in p) for i in range(3)])
        if lo.z < rim - .01 or min(hi.x - lo.x, hi.y - lo.y) > .01: continue          # not a flap: flaps start at the rim and are a few mm thick
        tip = min(tip, rim - (hi.z - lo.z))
        hinge = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
        away = Vector((hinge.x - mid.x, hinge.y - mid.y, 0)).normalized()
        turn = Matrix.Translation(hinge) @ Matrix.Rotation(math.radians(172), 4, Vector((0, 0, 1)).cross(away)) @ Matrix.Translation(-hinge)
        o.matrix_world = turn @ o.matrix_world
    for o in [o for o in meshes if o.name.startswith('Marks')]:   # the shipping marks would show through the folded flap: below its tip instead
        o.matrix_world = Matrix.Translation((0, 0, tip - .005 - max(p.z for p in pts(o)))) @ o.matrix_world

# Mostly fine detail (bristles, scan noise): a small share still reads from across the room. Vertex colours go unused.
for o in meshes:
    o.modifiers.new('lite', 'DECIMATE').ratio = float(keep)
    for a in list(o.data.color_attributes): o.data.color_attributes.remove(a)

bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True,
                          export_image_format='WEBP', export_jpeg_quality=80,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                          export_cameras=False, export_lights=False, export_animations=False)
