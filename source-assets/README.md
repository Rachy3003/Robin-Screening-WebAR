# Robin source model

`robin-original.glb` is the uncompressed 7.1 MB source model. It is kept outside
`src/` so it is not included in the production build.

The deployed `src/assets/robin.glb` uses the conservative glTF Transform pipeline:

```sh
gltf-transform optimize robin-original.glb robin.glb \
  --compress draco \
  --texture-compress webp \
  --texture-size 1024 \
  --simplify false
```

This retains the original geometry and 1024 × 1024 texture resolution.
