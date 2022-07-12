typedef unsigned char  uint8_t;
typedef unsigned short uint16_t;
typedef unsigned int   uint32_t;
#pragma once

typedef unsigned long long uint64_t;
typedef unsigned long size_t;
typedef short int16_t;
typedef int   int32_t;
typedef int bool;
#define true 1
#define false 0

extern void abort();

extern void* malloc(size_t size);
extern void* malloc_aligned(size_t size, size_t alignment);