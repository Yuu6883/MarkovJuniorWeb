#!/bin/bash

for f in *.ts; do 
    cp -- "$f" ../bin/"${f%.ts}.as"
done

npx asc observation.ts -O3 --noAssert --importMemory -o ../bin/v2.wasm