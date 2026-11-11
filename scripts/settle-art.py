# Settles the art box's contents with Blender's rigid-body physics (Bullet) -> public/assets/art-layout.json, read by rack.js.
# Usage: blender -b --factory-startup --disable-autoexec --python scripts/settle-art.py -- public/assets public/assets/art-layout.json
# The box and the cup are fixed (their mesh is the collider); the spray can drops onto the box bottom, and the two tubes and three
# brushes start standing in the cup, a little tilted, and settle against each other and its rim. Same inputs, same result: Bullet is deterministic and nothing here is random.
import bpy, json, math, sys
from mathutils import Matrix, Vector

src, out = sys.argv[sys.argv.index('--') + 1:][:2]
BOX_SCALE = .65                                             # the box at 65% so the tools fill it; the rest stays real size (rack.js scales the box the same)
for o in list(bpy.data.objects): bpy.data.objects.remove(o)   # the factory scene's cube, camera and light
scene = bpy.context.scene

def load(name):
    """One object per glb, vertices in the glb's own frame (Z up), its origin at its bounds' centre (the rigid body's centre of mass)."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f'{src}/{name}.glb')
    new = [o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update()
    meshes = [o for o in new if o.type == 'MESH']
    for o in meshes: mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    for o in new:
        if o.type != 'MESH': bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    o.name = name; o['c'] = list(o.location)              # glb origin -> centre offset, to undo when writing the layout
    return o

def body(o, kind, shape, **kw):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.rigidbody.object_add(type=kind)
    rb = o.rigid_body; rb.collision_shape = shape; rb.friction = .7; rb.restitution = .05
    rb.linear_damping, rb.angular_damping, rb.collision_margin = .2, .4, .001
    for k, v in kw.items(): setattr(rb, k, v)

def size(o): return Vector([max((o.matrix_world @ Vector(c))[i] for c in o.bound_box) - min((o.matrix_world @ Vector(c))[i] for c in o.bound_box) for i in range(3)])

bpy.ops.rigidbody.world_add()
w = scene.rigidbody_world; w.substeps_per_frame, w.solver_iterations = 20, 20   # thin cardboard and a thin cup wall: small steps, or things tunnel through
w.point_cache.frame_end = 100

box = load('box')                                           # stays where the glb has it: bottom at z 0, centred on x and y
box.matrix_world = Matrix.Scale(BOX_SCALE, 4) @ box.matrix_world   # about the glb origin, so the bottom stays at z 0
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.context.view_layer.update()
floor = scene.ray_cast(bpy.context.view_layer.depsgraph, Vector((-.07 * BOX_SCALE, 0, .2)), Vector((0, 0, -1)))[1].z   # the box's inside bottom
wall = lambda d: scene.ray_cast(bpy.context.view_layer.depsgraph, Vector((0, 0, floor + .05)), Vector(d))[1]   # the box's inside walls, for the check at the end
x0, x1, y0, y1 = wall((-1, 0, 0)).x, wall((1, 0, 0)).x, wall((0, -1, 0)).y, wall((0, 1, 0)).y
rim = max((box.matrix_world @ Vector(c)).z for c in box.bound_box)   # above the walls' top a brush may lean out over the edge
body(box, 'PASSIVE', 'MESH')

cup = load('cup')
cup.location = (-.07 * BOX_SCALE, 0, floor + size(cup).z / 2 + .0005)    # off-centre on the bottom, fixed
body(cup, 'PASSIVE', 'MESH')
bpy.context.view_layer.update()
inside = scene.ray_cast(bpy.context.view_layer.depsgraph, cup.location + Vector((0, 0, .2)), Vector((0, 0, -1)))[1].z   # the cup's inside bottom

can = load('spraycan')
can.location = (.1 * BOX_SCALE, .035 * BOX_SCALE, floor + size(can).z / 2 + .003)
body(can, 'ACTIVE', 'CONVEX_HULL', mass=.35)

# standing in the cup on a ring 1.4 cm out from its middle, each turned to its own side and tilted 6 degrees outward, 4 mm above the bottom:
# dropped from above, they bounce and topple out of a 9 cm cup
stand = [('tube', 'tube'), ('tube', 'tube-2'), ('paintbrush-1', 'paintbrush-1'), ('paintbrush-2', 'paintbrush-2'), ('paintbrush-3', 'paintbrush-3')]
for i, (f, name) in enumerate(stand):
    o = load(f); o.name = name; o['c'] = list(o.location)
    a = i / len(stand) * 2 * math.pi + .4
    ring = Vector((math.cos(a), math.sin(a), 0))
    o.matrix_world = Matrix.Translation(o.location) @ Matrix.Rotation(math.radians(6), 4, Vector((0, 0, 1)).cross(ring)) @ Matrix.Rotation(a, 4, 'Z')
    bpy.context.view_layer.update()
    lo = min((o.matrix_world @ Vector(c)).z for c in o.bound_box)
    mid = sum((o.matrix_world @ Vector(c) for c in o.bound_box), Vector()) / 8
    o.location += Vector((cup.location.x + ring.x * .014 - mid.x, cup.location.y + ring.y * .014 - mid.y, inside + .004 - lo))
    body(o, 'ACTIVE', 'CONVEX_HULL', mass=.03 if 'brush' in name else .06)

for f in range(1, w.point_cache.frame_end + 1): scene.frame_set(f)

# each glb's root transform in three.js terms: Blender is Z up, glTF Y up (Blender point = Rx(90) * glTF point)
C = Matrix.Rotation(math.radians(90), 4, 'X')
dg = bpy.context.evaluated_depsgraph_get(); layout = {}
for name in ['cup', 'spraycan', 'tube', 'tube-2', 'paintbrush-1', 'paintbrush-2', 'paintbrush-3']:
    o = bpy.data.objects[name]
    m = C.inverted() @ o.evaluated_get(dg).matrix_world @ Matrix.Translation(-Vector(o['c'])) @ C
    p, q, _ = m.decompose()
    layout[name] = {'p': [round(v, 5) for v in p], 'q': [round(v, 6) for v in (q.x, q.y, q.z, q.w)]}
    print('SETTLED', name, layout[name])
    for v in o.data.vertices:                               # self-check: nothing went through a wall or sank through the bottom
        w = o.evaluated_get(dg).matrix_world @ v.co
        assert (w.z > rim or x0 - .001 < w.x < x1 + .001 and y0 - .001 < w.y < y1 + .001) and w.z > floor - .001, f'{name} is outside the box at {tuple(w)}'
json.dump(layout, open(out, 'w'), indent=1)
