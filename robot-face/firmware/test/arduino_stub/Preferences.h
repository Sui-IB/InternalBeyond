#ifndef RF_PREFS_STUB_H
#define RF_PREFS_STUB_H
#include <stdint.h>
#include <stddef.h>
class Preferences {
 public:
  bool begin(const char* name, bool readOnly);
  size_t putUShort(const char* key, uint16_t v);
  size_t putULong(const char* key, uint32_t v);
  uint16_t getUShort(const char* key, uint16_t def);
  uint32_t getULong(const char* key, uint32_t def);
};
#endif
