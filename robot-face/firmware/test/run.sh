#!/usr/bin/env bash
# 在电脑上测试固件核心逻辑（不需要开发板）。
# 用法：bash firmware/test/run.sh
set -euo pipefail
cd "$(dirname "$0")"

# 有 node 的话，先用浏览器端的编码器重新生成测试向量，保证两边始终一致
if command -v node >/dev/null 2>&1; then
  node gen_js_frames.js > js_frames.h
fi

g++ -std=c++11 -Wall -Wextra -Werror -O1 -o test_core test_core.cpp
./test_core

# main.cpp 依赖 Arduino，这里只用桩头文件做语法和类型检查（不链接、不运行）。
# 真正的编译请用 PlatformIO：pio run -e esp32dev
for flags in "" "-DRF_PIN_OE=5"; do
  g++ -std=c++11 -Wall -Wextra -Werror -fsyntax-only -Iarduino_stub $flags ../src/main.cpp
done
echo "main.cpp 语法检查通过（桩头文件，未做真实交叉编译）"
