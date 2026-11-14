#!/bin/sh
# Shrinks the room's models for slow connections: the dense props lose most of their vertices (they are small on screen), and the rack's
# 2048 px textures go to 1024. Run once on the originals: sh scripts/shrink-models.sh <dir of original glbs>  (it writes public/assets/*.glb)
set -e
src=${1:?usage: sh scripts/shrink-models.sh <dir of original glbs>}
gt="npx -y @gltf-transform/cli@4.5.1"
tmp=$(mktemp -d)
for f in paintbrush-1:0.01 paintbrush-2:0.01 paintbrush-3:0.01 box:0.001 cup:0.001 lamp:0.001; do   # name:the error simplify may add, as a share of the model's size
  e=${f#*:} f=${f%:*}
  $gt weld "$src/$f.glb" "$tmp/$f-w.glb"
  $gt simplify "$tmp/$f-w.glb" "$tmp/$f-s.glb" --ratio 0.25 --error "$e"
  $gt draco "$tmp/$f-s.glb" "public/assets/$f.glb"
done
$gt resize "$src/rack.glb" public/assets/rack.glb --width 1024 --height 1024
rm -rf "$tmp"
# second pass (2026-11-12, for phones), on the outputs above plus the untouched tube and spray can. The box and cup stay: their hard edges lock the simplifier
# for f in lamp paintbrush-1 paintbrush-2 paintbrush-3 tube spraycan; do weld, then simplify --ratio 0.15 --error 0.01, then draco, as above; done
# the desk (2026-11-12): Poly Haven's metal_office_desk, its 1k glTF straight to the room in one pass:
# $gt optimize metal_office_desk.gltf public/assets/desk.glb --compress draco --texture-compress webp --texture-size 512 --simplify-ratio 0.5
# GPU-compressed textures (2026-11-14, for Safari's memory limit): KTX2, a fraction of a decoded image's video memory. Needs KTX-Software's `ktx`
# (github.com/KhronosGroup/KTX-Software releases; its .pkg unpacks with `pkgutil --expand-full`, bin/ and lib/ side by side).
# The room's surfaces, from ambientCG's 1K JPEGs (in git history): flipped upside down (three draws a JPEG flipped, a KTX2 as stored), then UASTC
# with RDO and zstd, mipmapped; the colour maps sRGB, the normal and roughness maps linear data:
#   for f in tex/*.jpg; do sips -s format png -f vertical "$f" --out "${f%.jpg}.png"; done
#   ktx create --format R8G8B8_SRGB --assign-tf srgb --encode uastc --uastc-quality 2 --uastc-rdo --uastc-rdo-l 1 --zstd 18 --generate-mipmap X-diff.png X-diff.ktx2
#   ktx create --format R8G8B8_UNORM --assign-tf linear (the rest as above) X-nor.png X-nor.ktx2   (and X-rough)
# The rack: its WebP textures to PNG first (ktx reads no WebP), then UASTC for the data maps and ETC1S for the near-black colour ones:
#   $gt png rack.glb r1.glb --formats "*"
#   $gt uastc r1.glb r2.glb --slots "@(normalTexture|occlusionTexture|metallicRoughnessTexture)" --level 2 --rdo --rdo-lambda 1 --zstd 18
#   $gt etc1s r2.glb public/assets/rack.glb --slots "@(baseColorTexture|emissiveTexture)" --quality 255
