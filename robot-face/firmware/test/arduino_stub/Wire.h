#ifndef RF_WIRE_STUB_H
#define RF_WIRE_STUB_H
#include <stdint.h>
#include <stddef.h>
struct TwoWireStub {
  bool begin(int sda, int scl);
  void setClock(uint32_t hz);
  void beginTransmission(uint8_t addr);
  size_t write(uint8_t b);
  uint8_t endTransmission();
};
extern TwoWireStub Wire;
#endif
