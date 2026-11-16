// RF-01 下位机核心逻辑（可移植 C++11，不依赖 Arduino）
//
// 实现 docs/PROTOCOL.md 的全部规则：按行解析、可选 *HH 校验、? P L L? V T R 命令、
// 每通道限位钳制、看门狗、速度限制、上电不动作。
// 硬件相关的事情全部通过 Hal 接口完成，所以这份代码可以在电脑上用 g++ 直接测试
// （见 firmware/test/）。
#ifndef RF_CORE_H
#define RF_CORE_H

#include <stdint.h>
#include <stddef.h>

namespace rf {

static const int kChannels = 16;
static const int kHardMinUs = 500;
static const int kHardMaxUs = 2500;
static const int kDefaultMinUs = 900;
static const int kDefaultMaxUs = 2100;
static const uint32_t kDefaultWatchdogMs = 1000;
static const uint32_t kMaxWatchdogMs = 600000;      // 10 分钟
static const uint32_t kMaxSlewUsPerS = 1000000;
static const int kMaxLine = 160;                    // 单行最长字节数（不含换行）
static const int kPwmHz = 50;
#define RF_FW_VERSION "0.1.0"

enum ErrCode { kErrChecksum = 1, kErrFormat = 2, kErrRange = 3, kErrUnknown = 4 };

// 硬件抽象层：由 main.cpp（真机）或测试里的假实现提供。
struct Hal {
  virtual ~Hal() {}
  virtual void setPulse(int ch, int us) = 0;               // 让第 ch 路输出 us 微秒的脉宽
  virtual void release(int ch) = 0;                        // 第 ch 路停止输出（舵机松开）
  virtual void saveLimit(int ch, int minUs, int maxUs) = 0;  // 写入闪存
  virtual void saveSlew(uint32_t usPerS) = 0;
  virtual void saveWatchdog(uint32_t ms) = 0;
  virtual uint32_t millis() = 0;
  virtual void writeLine(const char* line) = 0;            // 向主机回一行（不含换行）
};

class Core {
 public:
  explicit Core(Hal& hal)
      : hal_(hal), slewUsPerS_(0), watchdogMs_(kDefaultWatchdogMs), lineLen_(0), overflow_(false),
        lastFrameMs_(0), lastTickMs_(0), slewRem_(0), tickStarted_(false), anyActive_(false) {
    for (int i = 0; i < kChannels; ++i) {
      minUs_[i] = kDefaultMinUs;
      maxUs_[i] = kDefaultMaxUs;
      active_[i] = false;
      targetQ_[i] = 0;
      currentQ_[i] = 0;
      outUs_[i] = 0;
    }
  }

  // ── 开机时从闪存恢复设置（不产生任何输出，也不回写闪存） ──
  bool loadLimit(int ch, int minUs, int maxUs) {
    if (ch < 0 || ch >= kChannels) return false;
    if (!(minUs >= kHardMinUs && minUs < maxUs && maxUs <= kHardMaxUs)) return false;
    minUs_[ch] = minUs;
    maxUs_[ch] = maxUs;
    return true;
  }
  void loadSlew(uint32_t usPerS) { slewUsPerS_ = usPerS > kMaxSlewUsPerS ? kMaxSlewUsPerS : usPerS; }
  void loadWatchdog(uint32_t ms) { watchdogMs_ = ms > kMaxWatchdogMs ? kMaxWatchdogMs : ms; }

  // ── 串口收到的每个字节都喂进来 ──
  void feed(char c) {
    if (c == '\r') return;
    if (c == '\n') {
      if (overflow_) {
        error(kErrFormat, "line too long");
      } else if (lineLen_ > 0) {
        line_[lineLen_] = '\0';
        handleLine();
      }
      lineLen_ = 0;
      overflow_ = false;
      return;
    }
    if (overflow_) return;
    if (lineLen_ >= kMaxLine) { overflow_ = true; return; }
    line_[lineLen_++] = c;
  }
  void feed(const char* s) { while (*s) feed(*s++); }

  // ── 主循环里尽量频繁地调用：处理看门狗和速度限制 ──
  void tick() {
    uint32_t now = hal_.millis();
    uint32_t dt = tickStarted_ ? (uint32_t)(now - lastTickMs_) : 0;
    lastTickMs_ = now;
    tickStarted_ = true;

    if (anyActive_ && watchdogMs_ > 0 && (uint32_t)(now - lastFrameMs_) > watchdogMs_) {
      releaseAll();
      return;
    }
    if (slewUsPerS_ == 0 || dt == 0) return;
    // Q6 定点（1/64 µs）。除不尽的余数留到下一次，这样很慢的速度累计起来也不走样。
    if (dt > 1000) dt = 1000;
    uint64_t num = (uint64_t)slewUsPerS_ * dt * 64u + slewRem_;
    int32_t step = (int32_t)(num / 1000u);
    slewRem_ = (uint32_t)(num % 1000u);
    if (step == 0) return;
    for (int i = 0; i < kChannels; ++i) {
      if (!active_[i] || currentQ_[i] == targetQ_[i]) continue;
      int32_t d = targetQ_[i] - currentQ_[i];
      if (d > step) d = step;
      if (d < -step) d = -step;
      currentQ_[i] += d;
      output(i);
    }
  }

  // ── 状态查询（测试和调试用） ──
  bool isActive(int ch) const { return ch >= 0 && ch < kChannels && active_[ch]; }
  int outputUs(int ch) const { return (ch >= 0 && ch < kChannels && active_[ch]) ? outUs_[ch] : 0; }
  int limitMin(int ch) const { return minUs_[ch]; }
  int limitMax(int ch) const { return maxUs_[ch]; }
  uint32_t slew() const { return slewUsPerS_; }
  uint32_t watchdog() const { return watchdogMs_; }

 private:
  Hal& hal_;
  int minUs_[kChannels];
  int maxUs_[kChannels];
  bool active_[kChannels];
  int32_t targetQ_[kChannels];    // 目标脉宽，Q6
  int32_t currentQ_[kChannels];   // 当前输出，Q6
  int outUs_[kChannels];          // 上一次真正写给硬件的整数脉宽
  uint32_t slewUsPerS_;
  uint32_t watchdogMs_;
  char line_[kMaxLine + 1];
  int lineLen_;
  bool overflow_;
  uint32_t lastFrameMs_;
  uint32_t lastTickMs_;
  uint32_t slewRem_;              // 速度限制的定点余数
  bool tickStarted_;
  bool anyActive_;

  static int hexVal(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    return -1;
  }
  static bool isSpace(char c) { return c == ' ' || c == '\t'; }

  // 读一个无符号十进制数；成功时 p 前移。超过 9 位数字视为格式错误之外的“过大”，饱和到 999999999。
  static bool parseUint(const char*& p, uint32_t& out) {
    while (isSpace(*p)) ++p;
    if (*p < '0' || *p > '9') return false;
    uint32_t v = 0;
    int digits = 0;
    while (*p >= '0' && *p <= '9') {
      if (digits < 9) v = v * 10u + (uint32_t)(*p - '0');
      else v = 999999999u;
      ++digits;
      ++p;
    }
    if (*p != '\0' && !isSpace(*p)) return false;      // 数字后面只能是空白或行尾
    out = v;
    return true;
  }
  static bool atEnd(const char* p) {
    while (isSpace(*p)) ++p;
    return *p == '\0';
  }

  void error(int code, const char* msg) {
    char buf[48];
    int n = 0;
    const char* head = "ERR ";
    while (*head) buf[n++] = *head++;
    buf[n++] = (char)('0' + code);
    buf[n++] = ' ';
    while (*msg && n < (int)sizeof(buf) - 1) buf[n++] = *msg++;
    buf[n] = '\0';
    hal_.writeLine(buf);
  }
  void ok() { hal_.writeLine("OK"); }

  static int appendUint(char* buf, int n, uint32_t v) {
    char tmp[12];
    int t = 0;
    do { tmp[t++] = (char)('0' + v % 10u); v /= 10u; } while (v);
    while (t) buf[n++] = tmp[--t];
    return n;
  }

  void output(int ch) {
    int us = (int)((currentQ_[ch] + 32) >> 6);
    if (us != outUs_[ch]) {
      outUs_[ch] = us;
      hal_.setPulse(ch, us);
    }
  }
  void releaseChannel(int ch) {
    if (active_[ch]) {
      active_[ch] = false;
      outUs_[ch] = 0;
      hal_.release(ch);
    }
  }
  void releaseAll() {
    for (int i = 0; i < kChannels; ++i) releaseChannel(i);
    anyActive_ = false;
  }
  void refreshAnyActive() {
    anyActive_ = false;
    for (int i = 0; i < kChannels; ++i) if (active_[i]) { anyActive_ = true; break; }
  }
  int clampToLimit(int ch, uint32_t us) const {
    if (us < (uint32_t)minUs_[ch]) return minUs_[ch];
    if (us > (uint32_t)maxUs_[ch]) return maxUs_[ch];
    return (int)us;
  }
  void setTarget(int ch, int us) {
    targetQ_[ch] = (int32_t)us << 6;
    if (!active_[ch] || slewUsPerS_ == 0) {
      // 刚从松开状态恢复，或者没开速度限制：直接到位
      active_[ch] = true;
      currentQ_[ch] = targetQ_[ch];
      outUs_[ch] = us;
      hal_.setPulse(ch, us);
    }
  }

  void handleLine() {
    // 1) 可选校验：最后一个 '*' 之后必须正好是两位十六进制
    int star = -1;
    for (int i = lineLen_ - 1; i >= 0; --i) if (line_[i] == '*') { star = i; break; }
    if (star >= 0) {
      int h = (lineLen_ - star == 3) ? hexVal(line_[star + 1]) : -1;
      int l = (lineLen_ - star == 3) ? hexVal(line_[star + 2]) : -1;
      uint8_t x = 0;
      for (int i = 0; i < star; ++i) x ^= (uint8_t)line_[i];
      if (h < 0 || l < 0 || (uint8_t)((h << 4) | l) != x) { error(kErrChecksum, "checksum"); return; }
      line_[star] = '\0';
    }
    const char* p = line_;
    while (isSpace(*p)) ++p;
    if (*p == '\0') return;
    char cmd = *p++;

    if (cmd == '?') {
      if (!atEnd(p)) { error(kErrFormat, "format"); return; }
      hal_.writeLine("RF1 fw=" RF_FW_VERSION " ch=16 hz=50");
      return;
    }
    if (cmd == 'P') { cmdP(p); return; }
    if (cmd == 'L') { cmdL(p); return; }
    if (cmd == 'V') {
      uint32_t v;
      if (!isSpace(*p) || !parseUint(p, v) || !atEnd(p)) { error(kErrFormat, "format"); return; }
      if (v > kMaxSlewUsPerS) { error(kErrRange, "range"); return; }
      slewUsPerS_ = v;
      hal_.saveSlew(v);
      ok();
      return;
    }
    if (cmd == 'T') {
      uint32_t v;
      if (!isSpace(*p) || !parseUint(p, v) || !atEnd(p)) { error(kErrFormat, "format"); return; }
      if (v > kMaxWatchdogMs) { error(kErrRange, "range"); return; }
      watchdogMs_ = v;
      lastFrameMs_ = hal_.millis();     // 改超时的瞬间不要立刻触发
      hal_.saveWatchdog(v);
      ok();
      return;
    }
    if (cmd == 'R') {
      if (!atEnd(p)) { error(kErrFormat, "format"); return; }
      releaseAll();
      ok();
      return;
    }
    error(kErrUnknown, "unknown");
  }

  void cmdP(const char* p) {
    if (!isSpace(*p)) { error(kErrFormat, "format"); return; }
    uint32_t vals[kChannels];
    int n = 0;
    while (!atEnd(p)) {
      uint32_t v;
      if (n >= kChannels || !parseUint(p, v)) { error(kErrFormat, "format"); return; }
      vals[n++] = v;
    }
    if (n == 0) { error(kErrFormat, "format"); return; }
    // 整行都合法才生效
    for (int i = 0; i < n; ++i) {
      if (vals[i] == 0) releaseChannel(i);
      else setTarget(i, clampToLimit(i, vals[i]));
    }
    lastFrameMs_ = hal_.millis();
    refreshAnyActive();
  }

  void cmdL(const char* p) {
    if (*p == '?') {
      ++p;
      if (!atEnd(p)) { error(kErrFormat, "format"); return; }
      for (int i = 0; i < kChannels; ++i) {
        char buf[32];
        int n = 0;
        buf[n++] = 'L'; buf[n++] = ' ';
        n = appendUint(buf, n, (uint32_t)i); buf[n++] = ' ';
        n = appendUint(buf, n, (uint32_t)minUs_[i]); buf[n++] = ' ';
        n = appendUint(buf, n, (uint32_t)maxUs_[i]);
        buf[n] = '\0';
        hal_.writeLine(buf);
      }
      ok();
      return;
    }
    uint32_t ch, mn, mx;
    if (!isSpace(*p) || !parseUint(p, ch) || !parseUint(p, mn) || !parseUint(p, mx) || !atEnd(p)) {
      error(kErrFormat, "format");
      return;
    }
    if (ch >= (uint32_t)kChannels || mn < (uint32_t)kHardMinUs || mx > (uint32_t)kHardMaxUs || mn >= mx) {
      error(kErrRange, "range");
      return;
    }
    minUs_[ch] = (int)mn;
    maxUs_[ch] = (int)mx;
    hal_.saveLimit((int)ch, (int)mn, (int)mx);
    // 正在输出的通道如果落在新限位之外，立刻拉回来
    if (active_[ch]) {
      int32_t lo = (int32_t)mn << 6, hi = (int32_t)mx << 6;
      if (targetQ_[ch] < lo) targetQ_[ch] = lo;
      if (targetQ_[ch] > hi) targetQ_[ch] = hi;
      if (currentQ_[ch] < lo) currentQ_[ch] = lo;
      if (currentQ_[ch] > hi) currentQ_[ch] = hi;
      output((int)ch);
    }
    ok();
  }
};

}  // namespace rf

#endif  // RF_CORE_H
