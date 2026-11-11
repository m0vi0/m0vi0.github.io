# Stands the record shelf's 20 sleeves on their side, 5 in each of its 4 cubes, spines out, with Blender's rigid-body physics (Bullet)
# -> public/assets/record-layout.json, read by rack.js (buildVinyl). Usage:
#   blender -b --factory-startup --disable-autoexec --python scripts/settle-records.py -- public/assets/record-layout.json
# Each cube's floor, walls, top and back are fixed boxes (sizes from buildVinyl: W .8, H .8, D .39, boards T .03, back .006). The sleeves start
# upright a little apart, each leaning toward its cube's left wall, and fall against it and each other like books; every cube starts a little
# differently so the four stacks don't look copied. Order: 1-5 top left, 6-10 top right, 11-15 bottom left, 16-20 bottom right. Deterministic.
import bpy, json, math, sys
from mathutils import Matrix, Vector

out = sys.argv[sys.argv.index('--') + 1]
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
scene = bpy.context.scene
W, H, D, T, BACK, S, TH = .8, .8, .39, .03, .006, .314, .004    # shelf, sleeve side, sleeve thickness
C = Matrix.Rotation(math.radians(90), 4, 'X')                     # three.js (Y up) point -> Blender (Z up) point

def block(lo, hi, kind, name, mass=1, turn=Matrix()):
    """A box from corner lo to hi in the shelf's three.js frame, then turned (a Blender world matrix): before its rigid body, which keeps the pose it starts with."""
    lo, hi = Vector(lo), Vector(hi)
    bpy.ops.mesh.primitive_cube_add(size=1, location=C @ ((lo + hi) / 2))
    o = bpy.context.object; o.name = name; s = hi - lo; o.scale = (s.x, s.z, s.y)   # three's z is Blender's -y
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)   # the origin stays the centre of mass
    o.matrix_world = turn @ o.matrix_world
    bpy.ops.rigidbody.object_add(type=kind)
    rb = o.rigid_body; rb.collision_shape = 'BOX'; rb.friction = .6; rb.restitution = .02; rb.collision_margin = .0005
    rb.linear_damping, rb.angular_damping, rb.mass = .3, .5, mass
    return o

bpy.ops.rigidbody.world_add()
w = scene.rigidbody_world; w.substeps_per_frame, w.solver_iterations = 40, 30   # 4 mm sleeves: small steps, or they tunnel
w.point_cache.frame_end = 120
z0, z1 = -D / 2 + BACK, D / 2
cubes = [(xa, xb, ya, yb) for ya, yb in [(H / 2 + T / 2, H - T), (T, H / 2 - T / 2)] for xa, xb in [(-W / 2 + T, -T / 2), (T / 2, W / 2 - T)]]   # insides: x0, x1, y0, y1
START = [(.02, .012, 3), (.026, .014, 4.5), (.016, .011, 2.5), (.03, .013, 3.5)]   # per cube: first gap to the wall, spacing, first lean (degrees)
for c, (x0, x1, y0, y1) in enumerate(cubes):
    k = T / 2                                                         # half a board: the boards between cubes are shared, so no wall may reach into the next cube
    for name, lo, hi in [('floor', (x0 - k, y0 - k, z0 - k), (x1 + k, y0, z1 + k)), ('top', (x0 - k, y1, z0 - k), (x1 + k, y1 + k, z1 + k)),
                         ('left', (x0 - k, y0, z0 - k), (x0, y1, z1 + k)), ('right', (x1, y0, z0 - k), (x1 + k, y1, z1 + k)),
                         ('back', (x0, y0, z0 - k), (x1, y1, z0))]:
        block(lo, hi, 'PASSIVE', f'{name}{c}')
    gap, step, lean0 = START[c]
    zc = z1 - S / 2 - .012                                            # spines 1.2 cm in from the open front
    for i in range(5):
        x = x0 + gap + i * step                                       # upright, leaning a little more each toward the left wall (clear of it and each other)
        hinge = C @ Vector((x - TH / 2, y0 + .002, zc))
        lean = Matrix.Translation(hinge) @ Matrix.Rotation(math.radians(lean0 + i / 2), 4, C.to_3x3() @ Vector((0, 0, 1))) @ Matrix.Translation(-hinge)
        block((x - TH / 2, y0 + .002, zc - S / 2), (x + TH / 2, y0 + .002 + S, zc + S / 2), 'ACTIVE', f'sleeve{c * 5 + i}', .2, lean)

for f in range(1, w.point_cache.frame_end + 1): scene.frame_set(f)

# each sleeve as rack.js builds it: a .314 x .314 x .004 box whose origin is its bottom front edge (centre at (0, .157, -.002) in its own frame),
# turned a quarter about y so its cover faces +x and an edge (the spine) faces the front
dg = bpy.context.evaluated_depsgraph_get(); layout = []
for i in range(20):
    x0, x1, y0, y1 = cubes[i // 5]
    o = bpy.data.objects[f'sleeve{i}']; mw = o.evaluated_get(dg).matrix_world
    m = C.inverted() @ mw @ C @ Matrix.Rotation(math.pi / 2, 4, 'Y') @ Matrix.Translation((0, -S / 2, TH / 2))
    p, q, _ = m.decompose()
    layout.append({'p': [round(v, 5) for v in p], 'q': [round(v, 6) for v in (q.x, q.y, q.z, q.w)]})
    print('SETTLED', i, layout[-1])
    for v in o.data.vertices:                                    # self-check: every corner still inside the cube
        c = C.inverted() @ (mw @ v.co)
        assert x0 - .001 < c.x < x1 + .001 and y0 - .001 < c.y < y1 + .001 and z0 - .001 < c.z < z1 + .001, f'sleeve {i} left the cube at {tuple(c)}'
json.dump(layout, open(out, 'w'), indent=1)
