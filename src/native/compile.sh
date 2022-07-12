#!/bin/bash

# -msimd128 \

clang \
    --target=wasm32 \
    -mbulk-memory \
    -O3 \
    -flto \
    -nostdlib \
    -Wno-implicit-function-declaration \
    -Wl,--no-entry \
    -Wl,--export-all \
    -Wl,--lto-O3 \
    -Wl,--import-memory \
    -Wl,--allow-undefined \
    -o ../bin/rule.wasm \
    observation.c
