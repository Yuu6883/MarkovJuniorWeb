# [MarkovJuniorWeb](https://yuu6883.github.io/MarkovJuniorWeb/)

Typescript version of [MarkovJunior](https://github.com/mxgmn/MarkovJunior), runs in [browser](https://yuu6883.github.io/MarkovJuniorWeb/) (also in node.js).

-   Everything have been implemented including isometric rendering, exporting the output as a `.vox` file, and node tree visualization.
-   Every model from the original repository can be loaded with this project, but the output would be different due to different random seed implementation (dotnet builtin vs [seededrandom](https://www.npmjs.com/package/seedrandom)).

![demo](https://user-images.githubusercontent.com/38842891/181451017-bcd68575-7586-41d7-b864-2c03aba3d45f.gif)
![RTX=on](https://user-images.githubusercontent.com/38842891/181451923-2a310772-addd-4573-aa58-9bd60d238715.png)

## Development

Install dependensies:

```bash
npm i
```

Start development server on localhost:

```bash
npm start
```

Build static site:

```bash
npm build
```

Run in node (writes result to `/output`):

```bash
npm run cli
```

## TODO

-   node editor
-   import from & export to xml
-   voxel editor
-   file system on the web
-   optimization

### Performance

This port is around 2x slower than the original repo (JS vs C#), but it doesn't affect the page much; even with 200 steps per frame there's hardly any FPS drop on most models. However, the slowdown is quite noticable on computation expensive calculations, e.g. uni/bi-direction inference.

### Random Notes

`SokobanLevel1` takes ~10 seconds for the original C# code on my pc to reach the desired state, while it takes 20+ seconds on the web. I've tried JIT/unroll the rules into webassembly with generated AssemblyScript and it actually works: it gains a x2 speedup and the performance almost match the native C# version. The only problem is the load & compile time is terrilbe and it's incredibly hard to debug WebAssembly. I rolled back the commits on `main` and put the experimental stuff in the [`optimization`](https://github.com/Yuu6883/MarkovJuniorWeb/tree/optimization) branch, but I'm still pretty proud of this [MarkovJunior rules -> AssemblyScript -> Wasm](https://github.com/Yuu6883/MarkovJuniorWeb/blob/optimization/src/wasm/as.ts) JIT compiler I wrote.

_Update:_ I wrote a precompiled wasm version and it works fine, and the runtime is reduced from 20+ seconds on `SokobanLevel1` to ~13 seconds (not too bad I guess ¯\\\_(ツ)\_/¯ ).
