#!/bin/bash

clang \
    --target=wasm32 \
    -mbulk-memory \
    -O3 \
    -flto \
    -nostdlib \
    -Wl,--no-entry \
    -Wl,--export-all \
    -Wl,--lto-O3 \
    -Wl,--import-memory \
    -Wl,--allow-undefined \
    -o bin/v1.wasm \
    c-source/test.c