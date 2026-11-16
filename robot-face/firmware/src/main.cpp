// RF-01 下位机：ESP32 + PCA9685（Arduino 框架）
//
// 接线：
//   ESP32 SDA/SCL → PCA9685 SDA/SCL（引脚见 platformio.ini 里的 RF_PIN_SDA / RF_PIN_SCL）
//   ESP32 3V3     → PCA9685 VCC（逻辑电源）
//   独立 5V 电源  → PCA9685 V+（舵机电源，不要从开发板取电），并与 ESP32 共地
//   可选：ESP32 某个引脚 → PCA9685 OE（定义 RF_PIN_OE 后，上电时输出保持关闭直到初始化完成）
//
// 协议与安全规则全部在 rf_core.h 里，这个文件只负责把它接到真实硬件上。
#include <Arduino.h>
#include <Wire.h>
#include <Preferences.h>

#include "rf_core.h"

#ifndef RF_PIN_SDA
#define RF_PIN_SDA 21
#endif
#ifndef RF_PIN_SCL
#define RF_PIN_SCL 22
#endif
#ifndef RF_PIN_OE
#define RF_PIN_OE -1            // -1 = 不接 OE
#endif
#ifndef RF_PCA_ADDR
#define RF_PCA_ADDR 0x40
#endif
// PCA9685 内部振荡器标称 25 MHz，实际每片有几个百分点的偏差。
// 如果用示波器或逻辑分析仪量到的周期不是 20 ms，按比例改这个数。
#ifndef PCA_OSC_HZ
#define PCA_OSC_HZ 25000000UL
#endif

static const uint8_t REG_MODE1 = 0x00;
static const uint8_t REG_MODE2 = 0x01;
static const uint8_t REG_LED0_ON_L = 0x06;
static const uint8_t REG_PRESCALE = 0xFE;

static uint8_t g_prescale = 121;

static void pcaWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission((uint8_t)RF_PCA_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

static void pcaWrite4(uint8_t reg, uint16_t on, uint16_t off) {
  Wire.beginTransmission((uint8_t)RF_PCA_ADDR);
  Wire.write(reg);
  Wire.write((uint8_t)(on & 0xFF));
  Wire.write((uint8_t)(on >> 8));
  Wire.write((uint8_t)(off & 0xFF));
  Wire.write((uint8_t)(off >> 8));
  Wire.endTransmission();
}

static bool pcaInit() {
  Wire.beginTransmission((uint8_t)RF_PCA_ADDR);
  if (Wire.endTransmission() != 0) return false;            // 没有应答：没接或地址不对

  // 分频值：f = osc / (4096 × (prescale + 1))
  g_prescale = (uint8_t)((PCA_OSC_HZ + 2048UL * rf::kPwmHz) / (4096UL * rf::kPwmHz) - 1);
  pcaWrite(REG_MODE1, 0x10);                                // 睡眠后才能改分频
  pcaWrite(REG_PRESCALE, g_prescale);
  pcaWrite(REG_MODE2, 0x04);                                // 推挽输出
  pcaWrite(REG_MODE1, 0x20);                                // 唤醒 + 寄存器地址自增
  delay(2);
  for (int ch = 0; ch < rf::kChannels; ++ch) {
    pcaWrite4((uint8_t)(REG_LED0_ON_L + 4 * ch), 0, 0x1000);  // 全部关闭（OFF 的 bit12 = 常关）
  }
  return true;
}

class EspHal : public rf::Hal {
 public:
  Preferences prefs;

  void setPulse(int ch, int us) override {
    // 计数 = us × osc / (1e6 × (prescale + 1))，按实际分频算，比固定按 20 ms 算更准
    uint32_t counts = (uint32_t)(((uint64_t)us * PCA_OSC_HZ + 500000ULL * (g_prescale + 1)) /
                                 (1000000ULL * (g_prescale + 1)));
    if (counts > 4095) counts = 4095;
    pcaWrite4((uint8_t)(REG_LED0_ON_L + 4 * ch), 0, (uint16_t)counts);
  }
  void release(int ch) override { pcaWrite4((uint8_t)(REG_LED0_ON_L + 4 * ch), 0, 0x1000); }

  void saveLimit(int ch, int minUs, int maxUs) override {
    char key[8];
    snprintf(key, sizeof(key), "mn%d", ch);
    prefs.putUShort(key, (uint16_t)minUs);
    snprintf(key, sizeof(key), "mx%d", ch);
    prefs.putUShort(key, (uint16_t)maxUs);
  }
  void saveSlew(uint32_t usPerS) override { prefs.putULong("slew", usPerS); }
  void saveWatchdog(uint32_t ms) override { prefs.putULong("wdt", ms); }
  uint32_t millis() override { return ::millis(); }
  void writeLine(const char* line) override { Serial.println(line); }
};

static EspHal g_hal;
static rf::Core g_core(g_hal);

void setup() {
#if RF_PIN_OE >= 0
  pinMode(RF_PIN_OE, OUTPUT);
  digitalWrite(RF_PIN_OE, HIGH);                            // OE 高 = 输出关闭
#endif
  Serial.begin(115200);
  Wire.begin(RF_PIN_SDA, RF_PIN_SCL);
  Wire.setClock(400000);

  g_hal.prefs.begin("rf01", false);
  for (int ch = 0; ch < rf::kChannels; ++ch) {
    char key[8];
    snprintf(key, sizeof(key), "mn%d", ch);
    uint16_t mn = g_hal.prefs.getUShort(key, rf::kDefaultMinUs);
    snprintf(key, sizeof(key), "mx%d", ch);
    uint16_t mx = g_hal.prefs.getUShort(key, rf::kDefaultMaxUs);
    g_core.loadLimit(ch, mn, mx);                           // 闪存里的值不合法时保持默认
  }
  g_core.loadSlew(g_hal.prefs.getULong("slew", 0));
  g_core.loadWatchdog(g_hal.prefs.getULong("wdt", rf::kDefaultWatchdogMs));

  bool ok = pcaInit();
#if RF_PIN_OE >= 0
  digitalWrite(RF_PIN_OE, LOW);                             // 初始化完成，允许输出（此时各路仍是关闭状态）
#endif
  if (!ok) Serial.println("ERR 0 pca9685 not found");
}

void loop() {
  while (Serial.available() > 0) g_core.feed((char)Serial.read());
  g_core.tick();
}
