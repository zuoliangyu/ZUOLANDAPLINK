// 临时测试程序：检查 probe-rs 支持的 GD32 芯片
use probe_rs::config::families;

fn main() {
    println!("=== probe-rs 0.27 支持的所有芯片家族 ===\n");

    let all_families = families();

    for family in all_families {
        let family_name = &family.name;

        // 只显示 GD32 相关的
        if family_name.to_lowercase().contains("gd32") {
            println!("家族: {}", family_name);
            println!("  变体数量: {}", family.variants.len());

            for variant in &family.variants {
                println!("    - {}", variant.name);
            }
            println!();
        }
    }

    println!("\n=== 测试特定芯片 ===\n");

    let test_chips = vec![
        "GD32F103C8T6",
        "GD32F407VGT6",
        "GD32F470ZGT6",
        "GD32F407",
        "GD32F470",
    ];

    for chip in test_chips {
        match probe_rs::config::get_target_by_name(chip) {
            Ok(target) => println!("✓ {} - 支持 (实际名称: {})", chip, target.name),
            Err(e) => println!("✗ {} - 不支持: {}", chip, e),
        }
    }
}
