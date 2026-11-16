// 极简的 Arduino 桩，只用来在电脑上对 main.cpp 做语法和类型检查（-fsyntax-only）。
// 不是模拟器：函数都没有实现，不能链接运行。
#ifndef RF_ARDUINO_STUB_H
#define RF_ARDUINO_STUB_H
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#define HIGH 1
#define LOW 0
#define OUTPUT 1
void pinMode(int pin, int mode);
void digitalWrite(int pin, int level);
void delay(unsigned long ms);
unsigned long millis();
struct SerialStub {
  void begin(unsigned long baud);
  int available();
  int read();
  size_t println(const char* s);
};
extern SerialStub Serial;
#endif
