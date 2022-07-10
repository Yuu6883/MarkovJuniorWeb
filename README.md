# MarkovJuniorWeb
Typescript version of [MarkovJunior](https://github.com/mxgmn/MarkovJunior), runs on the web: https://yuu6883.github.io/MarkovJuniorWeb/
- Everything have been implemented including isometric rendering, exporting the output as a `.vox` file, and node tree visualization.
- **Every model from the original repository can be loaded with this project, but the output would be different due to different random seed implementation (dotnet builtin vs [seededrandom](https://www.npmjs.com/package/seedrandom))**.

![demo](https://user-images.githubusercontent.com/38842891/177889134-123a2029-c48a-410e-a700-7869b2e780b4.gif)
![RTX=on](https://user-images.githubusercontent.com/38842891/176314516-db9d3cbf-46c0-4856-bf1f-67e9e390a76c.png)

## TODO
- node editor
- import from & export to xml
- voxel editor
- file system
- optimization

### Performance
This port is around 2x slower than the original repo (JS vs C#), but it doesn't affect the page much; even with 200 steps per frame there's hardly any FPS drop on most models. However, the slowdown is quite noticable on computation expensive nodes, e.g. `<observe>` nodes with `search="True"`. `SokobanLevel1` takes ~10 seconds for the original C# code on my pc to reach the desired state, while it takes 20+ seconds on the web. I've tried JIT/unroll the rules into webassembly with generated AssemblyScript and it actually works: it gains a x2 speedup and the performance almost match the native C# version. The only problem is it's bugged on models other than Sokoban and it's incredibly hard to debug WebAssembly. I rolled back the commits on `main` and put the experimental stuff in the [`optimization`](https://github.com/Yuu6883/MarkovJuniorWeb/tree/optimization) branch, but I'm still pretty proud of this [MarkovJunior rules -> AssemblyScript -> Wasm](https://github.com/Yuu6883/MarkovJuniorWeb/blob/optimization/src/wasm/as.ts) JIT compiler I wrote. **Someone please take a look and debug it.** 😭
