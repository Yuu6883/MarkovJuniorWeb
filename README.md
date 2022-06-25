# WIP
Most 2D models should work now; only **wfc** node with tileset (TileNode class) is still being implemented.
Not sure about 3D models since **VoxHelper.save** is not implemented yet.

**Contribution would be appreciated** 🙏

# MarkovJuniorWeb
Typescript version of [MarkovJunior](https://github.com/mxgmn/MarkovJunior), runs on the web: https://yuu6883.github.io/MarkovJuniorWeb/

To test different models, use query string after the base url: ?model=blabla&speed=123&delay=100 (speed is steps per frame; delay is a time out until next frame)

Examples:
- https://yuu6883.github.io/MarkovJuniorWeb/?model=DungeonGrowth&speed=1
- https://yuu6883.github.io/MarkovJuniorWeb/?model=Flowers&speed=1
- https://yuu6883.github.io/MarkovJuniorWeb/?model=Growth&speed=250

## TODO
- Get rid of all the bugs
- Isometric renderer?
- Or just write a voxel renderer with webgpu
