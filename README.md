# WIP
Very few models work for now, due to my buggy port of 5,000 lines of code in 3 days.

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
