// rf_core.h 的电脑端测试：用假的 Hal 逐条验证 docs/PROTOCOL.md 里的规则。
// 编译运行见 run.sh。不需要任何测试框架。
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

#include "../src/rf_core.h"
#include "js_frames.h"

static int g_failed = 0;
static int g_checks = 0;

#define CHECK(cond)                                                              \
  do {                                                                           \
    ++g_checks;                                                                  \
    if (!(cond)) {                                                               \
      ++g_failed;                                                                \
      std::printf("  FAIL %s:%d  %s\n", __FILE__, __LINE__, #cond);              \
    }                                                                            \
  } while (0)

struct MockHal : public rf::Hal {
  int pulse[rf::kChannels];        // 当前输出，0 = 松开
  int setCalls;
  int releaseCalls;
  uint32_t now;
  std::vector<std::string> out;
  int savedMin[rf::kChannels];
  int savedMax[rf::kChannels];
  int saveLimitCalls;
  uint32_t savedSlew;
  int saveSlewCalls;
  uint32_t savedWatchdog;
  int saveWatchdogCalls;

  MockHal() : setCalls(0), releaseCalls(0), now(0), saveLimitCalls(0), savedSlew(0), saveSlewCalls(0),
              savedWatchdog(0), saveWatchdogCalls(0) {
    for (int i = 0; i < rf::kChannels; ++i) { pulse[i] = 0; savedMin[i] = 0; savedMax[i] = 0; }
  }
  void setPulse(int ch, int us) override { pulse[ch] = us; ++setCalls; }
  void release(int ch) override { pulse[ch] = 0; ++releaseCalls; }
  void saveLimit(int ch, int mn, int mx) override { savedMin[ch] = mn; savedMax[ch] = mx; ++saveLimitCalls; }
  void saveSlew(uint32_t v) override { savedSlew = v; ++saveSlewCalls; }
  void saveWatchdog(uint32_t v) override { savedWatchdog = v; ++saveWatchdogCalls; }
  uint32_t millis() override { return now; }
  void writeLine(const char* line) override { out.push_back(line); }

  std::string last() const { return out.empty() ? std::string() : out.back(); }
  void clearOut() { out.clear(); }
};

static void send(rf::Core& core, const char* line) {
  core.feed(line);
  core.feed('\n');
}
static bool startsWith(const std::string& s, const char* prefix) { return s.compare(0, std::strlen(prefix), prefix) == 0; }
static bool allReleased(const MockHal& h) {
  for (int i = 0; i < rf::kChannels; ++i) if (h.pulse[i] != 0) return false;
  return true;
}

static void testPowerOnSilent() {
  std::printf("上电不动作\n");
  MockHal h; rf::Core c(h);
  for (int i = 0; i < 50; ++i) { h.now += 100; c.tick(); }
  CHECK(h.setCalls == 0);
  CHECK(allReleased(h));
  send(c, "?");            // 握手不算 P，仍然不输出
  send(c, "L 0 1000 2000");
  send(c, "V 500");
  send(c, "T 500");
  send(c, "V 0");
  c.tick();
  CHECK(h.setCalls == 0);
  CHECK(allReleased(h));
}

static void testHelloAndChecksum() {
  std::printf("握手与校验\n");
  MockHal h; rf::Core c(h);
  send(c, "?*3F");                                     // 文档示例
  CHECK(h.last() == "RF1 fw=0.1.0 ch=16 hz=50");
  h.clearOut();
  send(c, "?");                                        // 不带校验也接受
  CHECK(h.last() == "RF1 fw=0.1.0 ch=16 hz=50");
  h.clearOut();
  send(c, "?*3f");                                     // 小写十六进制也接受
  CHECK(h.last() == "RF1 fw=0.1.0 ch=16 hz=50");

  h.clearOut();
  send(c, "?*00");                                     // 校验不对
  CHECK(startsWith(h.last(), "ERR 1"));
  h.clearOut();
  send(c, "P 1500 1500*51");                           // 校验不对：整行丢弃，不输出
  CHECK(startsWith(h.last(), "ERR 1"));
  CHECK(h.setCalls == 0);
  h.clearOut();
  send(c, "P 1500*5");                                 // 校验位数不够
  CHECK(startsWith(h.last(), "ERR 1"));
  h.clearOut();
  send(c, "P 1500*ZZ");
  CHECK(startsWith(h.last(), "ERR 1"));
  h.clearOut();
  send(c, "P 1500*5AA");
  CHECK(startsWith(h.last(), "ERR 1"));
  CHECK(h.setCalls == 0);
}

static void testFrames() {
  std::printf("P 帧、限位钳制、松开\n");
  MockHal h; rf::Core c(h);
  send(c, "P 1500 1500 1500 1500 1500 1500 1500 1500 1500 1500 1500 1500*50");   // 文档示例
  CHECK(h.out.empty());                                // 成功时不回复
  for (int i = 0; i < 12; ++i) CHECK(h.pulse[i] == 1500);
  for (int i = 12; i < 16; ++i) CHECK(h.pulse[i] == 0);   // 没给出的通道保持不变（仍然松开）

  send(c, "P 100 5000 899 2101");                      // 出厂限位 900–2100
  CHECK(h.pulse[0] == 900);
  CHECK(h.pulse[1] == 2100);
  CHECK(h.pulse[2] == 900);
  CHECK(h.pulse[3] == 2100);
  CHECK(h.pulse[4] == 1500);                           // 没给出的通道保持不变
  CHECK(h.out.empty());

  send(c, "P 0 1600");                                 // 0 = 该路松开
  CHECK(h.pulse[0] == 0);
  CHECK(!c.isActive(0));
  CHECK(h.pulse[1] == 1600);
  CHECK(c.outputUs(1) == 1600);

  send(c, "P 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16");  // 正好 16 个值，全部钳到下限
  CHECK(h.out.empty());
  for (int i = 0; i < 16; ++i) CHECK(h.pulse[i] == 900);

  // 格式错误：整行不生效
  int before = h.setCalls + h.releaseCalls;
  const char* bad[] = { "P", "P ", "P abc", "P 1500 -3", "P 1500 15x0", "P 1500,1600", "P1500",
                        "P 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17" };
  for (size_t i = 0; i < sizeof(bad) / sizeof(bad[0]); ++i) {
    h.clearOut();
    send(c, bad[i]);
    CHECK(startsWith(h.last(), "ERR 2"));
  }
  CHECK(h.setCalls + h.releaseCalls == before);
  for (int i = 0; i < 16; ++i) CHECK(h.pulse[i] == 900);

  h.clearOut();
  send(c, "P 999999999999 1500");                      // 极大的数：钳到上限，不溢出
  CHECK(h.out.empty());
  CHECK(h.pulse[0] == 2100);
  CHECK(h.pulse[1] == 1500);
}

static void testLimits() {
  std::printf("L 限位\n");
  MockHal h; rf::Core c(h);
  send(c, "L 7 1450 1950*56");                         // 文档示例
  CHECK(h.last() == "OK");
  CHECK(h.saveLimitCalls == 1);
  CHECK(h.savedMin[7] == 1450 && h.savedMax[7] == 1950);
  CHECK(c.limitMin(7) == 1450 && c.limitMax(7) == 1950);

  send(c, "P 1500 1500 1500 1500 1500 1500 1500 2000");
  CHECK(h.pulse[7] == 1950);
  send(c, "P 1500 1500 1500 1500 1500 1500 1500 1000");
  CHECK(h.pulse[7] == 1450);

  // 正在输出的通道，收紧限位后立刻被拉回
  send(c, "P 2000");
  CHECK(h.pulse[0] == 2000);
  h.clearOut();
  send(c, "L 0 1000 1800");
  CHECK(h.last() == "OK");
  CHECK(h.pulse[0] == 1800);

  const char* rangeErr[] = { "L 16 1000 2000", "L 0 499 2000", "L 0 1000 2501", "L 0 2000 1000",
                             "L 0 1500 1500", "L 99999 1000 2000" };
  int saves = h.saveLimitCalls;
  for (size_t i = 0; i < sizeof(rangeErr) / sizeof(rangeErr[0]); ++i) {
    h.clearOut();
    send(c, rangeErr[i]);
    CHECK(startsWith(h.last(), "ERR 3"));
  }
  const char* fmtErr[] = { "L", "L 1", "L 1 1000", "L 1 1000 2000 3", "L x 1000 2000", "L1 1000 2000" };
  for (size_t i = 0; i < sizeof(fmtErr) / sizeof(fmtErr[0]); ++i) {
    h.clearOut();
    send(c, fmtErr[i]);
    CHECK(startsWith(h.last(), "ERR 2"));
  }
  CHECK(h.saveLimitCalls == saves);                    // 出错时不写闪存
  CHECK(c.limitMin(0) == 1000 && c.limitMax(0) == 1800);

  send(c, "L 15 500 2500");                            // 硬限位边界本身合法
  CHECK(h.last() == "OK");

  h.clearOut();
  send(c, "L?");
  CHECK(h.out.size() == 17);
  CHECK(h.out[0] == "L 0 1000 1800");
  CHECK(h.out[1] == "L 1 900 2100");
  CHECK(h.out[7] == "L 7 1450 1950");
  CHECK(h.out[15] == "L 15 500 2500");
  CHECK(h.out[16] == "OK");

  // 开机从闪存恢复：非法值被拒绝，保持默认
  MockHal h2; rf::Core c2(h2);
  CHECK(c2.loadLimit(3, 1200, 1700));
  CHECK(!c2.loadLimit(4, 0, 65535));
  CHECK(!c2.loadLimit(16, 1000, 2000));
  CHECK(c2.limitMin(3) == 1200 && c2.limitMax(3) == 1700);
  CHECK(c2.limitMin(4) == 900 && c2.limitMax(4) == 2100);
  CHECK(h2.saveLimitCalls == 0 && h2.setCalls == 0);
}

static void testWatchdog() {
  std::printf("看门狗\n");
  MockHal h; rf::Core c(h);
  CHECK(c.watchdog() == 1000);                         // 默认 1000 ms
  send(c, "P 1500 1600");
  h.now = 1000; c.tick();
  CHECK(h.pulse[0] == 1500 && h.pulse[1] == 1600);     // 正好 1000 ms：还没超过
  h.now = 1001; c.tick();
  CHECK(allReleased(h));                               // 超过了：全部松开
  CHECK(!c.isActive(0) && !c.isActive(1));

  // 松开之后收到新的 P 立刻恢复
  send(c, "P 1400");
  CHECK(h.pulse[0] == 1400);
  CHECK(h.pulse[1] == 0);

  // 只有合法的 P 才喂狗：握手、别的命令、坏帧都不算
  h.now = 1500; send(c, "?"); c.tick();
  h.now = 1900; send(c, "V 0"); send(c, "P abc"); send(c, "P 1500*00"); c.tick();
  CHECK(h.pulse[0] == 1400);
  h.now = 2002; c.tick();
  CHECK(allReleased(h));

  // 持续发帧就一直保持
  for (int i = 0; i < 100; ++i) { h.now += 20; send(c, "P 1500"); c.tick(); }
  CHECK(h.pulse[0] == 1500);

  // T 修改超时并写闪存
  h.clearOut();
  send(c, "T 200");
  CHECK(h.last() == "OK");
  CHECK(h.savedWatchdog == 200 && h.saveWatchdogCalls == 1);
  send(c, "P 1500");
  h.now += 200; c.tick();
  CHECK(h.pulse[0] == 1500);
  h.now += 1; c.tick();
  CHECK(allReleased(h));

  // T 0 关闭看门狗
  send(c, "T 0");
  send(c, "P 1500");
  h.now += 3600000; c.tick();
  CHECK(h.pulse[0] == 1500);

  h.clearOut();
  send(c, "T 600001"); CHECK(startsWith(h.last(), "ERR 3"));
  send(c, "T");        CHECK(startsWith(h.last(), "ERR 2"));
  send(c, "T abc");    CHECK(startsWith(h.last(), "ERR 2"));
  send(c, "T 1 2");    CHECK(startsWith(h.last(), "ERR 2"));

  // millis() 回绕（约 49.7 天）时不误触发
  MockHal h3; rf::Core c3(h3);
  h3.now = 0xFFFFFF00u; c3.tick();
  send(c3, "P 1500");
  h3.now = 0x00000100u; c3.tick();                     // 实际只过了 512 ms
  CHECK(h3.pulse[0] == 1500);
  h3.now = 0x00000400u; c3.tick();                     // 过了 1280 ms
  CHECK(allReleased(h3));
}

static void testSlew() {
  std::printf("速度限制\n");
  MockHal h; rf::Core c(h);
  send(c, "T 0");                                      // 这里不想让看门狗干扰
  send(c, "V 1000");                                   // 1000 µs/s
  CHECK(h.last() == "OK");
  CHECK(h.savedSlew == 1000 && h.saveSlewCalls == 1);
  c.tick();

  send(c, "P 1500");                                   // 从松开恢复：直接跳到目标
  CHECK(h.pulse[0] == 1500);

  send(c, "P 2000");                                   // 之后按速度逼近
  CHECK(h.pulse[0] == 1500);
  h.now += 100; c.tick();
  CHECK(h.pulse[0] == 1600);
  h.now += 100; c.tick();
  CHECK(h.pulse[0] == 1700);
  int prev = h.pulse[0];
  for (int i = 0; i < 60; ++i) {                       // 每 10 ms 一步，单调上升，不超调
    h.now += 10; c.tick();
    CHECK(h.pulse[0] >= prev && h.pulse[0] <= 2000);
    prev = h.pulse[0];
  }
  CHECK(h.pulse[0] == 2000);

  send(c, "P 1900");                                   // 往回走
  h.now += 50; c.tick();
  CHECK(h.pulse[0] == 1950);
  h.now += 50; c.tick();
  CHECK(h.pulse[0] == 1900);
  h.now += 500; c.tick();
  CHECK(h.pulse[0] == 1900);

  // 目标被限位钳制后再做速度限制
  send(c, "P 5000");
  h.now += 1000; c.tick();
  CHECK(h.pulse[0] == 2100);

  // 松开再恢复：直接跳
  send(c, "P 0");
  CHECK(h.pulse[0] == 0);
  send(c, "P 1200");
  CHECK(h.pulse[0] == 1200);

  // V 0 关闭：立刻到位
  send(c, "V 0");
  send(c, "P 1800");
  CHECK(h.pulse[0] == 1800);

  h.clearOut();
  send(c, "V 1000001"); CHECK(startsWith(h.last(), "ERR 3"));
  send(c, "V");         CHECK(startsWith(h.last(), "ERR 2"));
  send(c, "V -5");      CHECK(startsWith(h.last(), "ERR 2"));

  // 很慢的速度也在动（定点精度）：10 µs/s，每 20 ms 一步，1 秒后正好走 10 µs
  MockHal h2; rf::Core c2(h2);
  send(c2, "T 0"); send(c2, "V 10"); c2.tick();
  send(c2, "P 1500"); send(c2, "P 1600");
  for (int i = 0; i < 50; ++i) { h2.now += 20; c2.tick(); }
  CHECK(h2.pulse[0] == 1510);
}

static void testMisc() {
  std::printf("R、未知命令、超长行、空行\n");
  MockHal h; rf::Core c(h);
  send(c, "P 1500 1500 1500");
  h.clearOut();
  send(c, "R");
  CHECK(h.last() == "OK");
  CHECK(allReleased(h));
  send(c, "R x"); CHECK(startsWith(h.last(), "ERR 2"));

  h.clearOut();
  send(c, "X");        CHECK(startsWith(h.last(), "ERR 4"));
  send(c, "hello");    CHECK(startsWith(h.last(), "ERR 4"));
  send(c, "p 1500");   CHECK(startsWith(h.last(), "ERR 4"));    // 命令区分大小写
  CHECK(allReleased(h));

  // 空行、只有 \r 的行：忽略，不回复
  h.clearOut();
  c.feed("\n\r\n   \n");
  CHECK(h.out.empty());

  // \r\n 结尾
  c.feed("P 1500\r\n");
  CHECK(h.pulse[0] == 1500);
  CHECK(h.out.empty());

  // 超长行（> 160 字节）：整行丢弃并报格式错误，下一行照常
  std::string longLine = "P";
  while (longLine.size() <= 160) longLine += " 1500";
  h.clearOut();
  send(c, longLine.c_str());
  CHECK(startsWith(h.last(), "ERR 2"));
  CHECK(h.pulse[1] == 0);
  send(c, "P 1500 1700");
  CHECK(h.pulse[1] == 1700);

  // 正好 160 字节的行可以接受
  std::string exact = "P 1500";
  while (exact.size() < 160) exact += ' ';
  CHECK(exact.size() == 160);
  h.clearOut();
  send(c, exact.c_str());
  CHECK(h.out.empty());
}

static void testJsFrames() {
  std::printf("主机端编码器生成的帧\n");
  MockHal h; rf::Core c(h);
  send(c, "T 0");
  h.clearOut();
  const int n = (int)(sizeof(kJsFrames) / sizeof(kJsFrames[0]));
  CHECK(n >= 10);
  for (int i = 0; i < n; ++i) {
    send(c, kJsFrames[i].line);
    CHECK(h.out.empty());                              // 没有任何 ERR
    for (int ch = 0; ch < kJsFrames[i].n; ++ch) CHECK(h.pulse[ch] == kJsFrames[i].expect[ch]);
  }
  send(c, kJsHello);      CHECK(h.last() == "RF1 fw=0.1.0 ch=16 hz=50");
  send(c, kJsLimit);      CHECK(h.last() == "OK"); CHECK(c.limitMin(7) == 1450 && c.limitMax(7) == 1950);
  send(c, kJsSlew);       CHECK(h.last() == "OK"); CHECK(c.slew() == 800);
  send(c, kJsWatchdog);   CHECK(h.last() == "OK"); CHECK(c.watchdog() == 250);
  h.clearOut();
  send(c, kJsLimitQuery); CHECK(h.out.size() == 17 && h.last() == "OK");
  send(c, "P 1500");
  send(c, kJsRelease);    CHECK(h.last() == "OK"); CHECK(allReleased(h));
}

int main() {
  testPowerOnSilent();
  testHelloAndChecksum();
  testFrames();
  testLimits();
  testWatchdog();
  testSlew();
  testMisc();
  testJsFrames();
  std::printf("\n%d 项检查，%d 项失败\n", g_checks, g_failed);
  return g_failed ? 1 : 0;
}
