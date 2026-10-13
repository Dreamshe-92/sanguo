# 从 .lib ROM 中提取 GBK 编码的中文字符串（武将名/城池名/菜单文案）
import re, sys, collections

path = sys.argv[1] if len(sys.argv) > 1 else "libs-dat-mod.lib"
data = open(path, "rb").read()
print("ROM size:", len(data))

# 魔法头
print("header:", data[:16])

# 扫描连续 GBK 汉字序列：GBK 汉字首字节 0xB0-0xF7, 次字节 0xA1-0xFE
gbk_re = re.compile(rb"(?:[\xb0-\xf7][\xa1-\xfe]){2,}")
strs = []
for m in gbk_re.finditer(data):
    try:
        s = m.group().decode("gbk")
    except Exception:
        continue
    strs.append((m.start(), len(s), s))

print("命中字符串段数:", len(strs))
out = []
for off, ln, s in strs:
    out.append(s)
print("总字符数:", sum(len(s) for s in out))
open("lib-text.txt", "w", encoding="utf-8").write("\n".join(out))
print("已保存 lib-text.txt")
print("=== 前 80 段 ===")
for s in out[:80]:
    print(off if False else "", s)
