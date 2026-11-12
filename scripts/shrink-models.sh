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
