"""
二軸振動触覚システムの使用例
"""
from src.haptic_system.controller import HapticController
import time


def basic_example():
    """基本的な使用例"""
    # コントローラーの初期化
    controller = HapticController(sample_rate=44100, block_size=512)
    
    # チャンネルパラメータの設定
    params = {
        "channels": [
            {"channel_id": 0, "frequency": 60, "amplitude": 0.5},  # デバイス1 X軸
            {"channel_id": 1, "frequency": 60, "amplitude": 0.5},  # デバイス1 Y軸
            {"channel_id": 2, "frequency": 80, "amplitude": 0.3},  # デバイス2 X軸
            {"channel_id": 3, "frequency": 80, "amplitude": 0.3},  # デバイス2 Y軸
        ]
    }
    
    # パラメータを更新
    controller.update_parameters(params)
    
    # ストリーミング開始（コンテキストマネージャー使用）
    with controller:
        print("Streaming started...")
        print(f"Current status: {controller.get_status()}")
        
        # 5秒間実行
        time.sleep(5)
        
        # 周波数を変更
        new_params = {
            "channels": [
                {"channel_id": 0, "frequency": 100, "amplitude": 0.8},
                {"channel_id": 1, "frequency": 100, "amplitude": 0.8},
            ]
        }
        controller.update_parameters(new_params)
        print("Parameters updated")
        
        # さらに5秒間実行
        time.sleep(5)
    
    print("Streaming stopped")


def vector_force_example():
    """ベクトル力覚生成の例"""
    controller = HapticController()
    
    with controller:
        # デバイス1で右方向（0度）の力を生成
        controller.device.set_vector_force(
            device_id=1,
            angle=0,
            magnitude=1.0,
            frequency=60
        )
        print("Generating rightward force on device 1")
        time.sleep(3)
        
        # デバイス1で上方向（90度）の力を生成
        controller.device.set_vector_force(
            device_id=1,
            angle=90,
            magnitude=1.0,
            frequency=60
        )
        print("Generating upward force on device 1")
        time.sleep(3)
        
        # デバイス1で45度方向の力を生成
        controller.device.set_vector_force(
            device_id=1,
            angle=45,
            magnitude=0.7,
            frequency=80
        )
        print("Generating diagonal force on device 1")
        time.sleep(3)


def research_based_example():
    """研究結果に基づく最適な力覚提示の例"""
    controller = HapticController()
    
    with controller:
        # 研究で推奨される10Hz、時間比1:8ののこぎり波
        # （実際の実装では波形のデューティ比制御が必要）
        controller.device.set_vector_force(
            device_id=1,
            angle=0,  # 右方向
            magnitude=1.0,
            frequency=10  # 最適な力覚提示周波数
        )
        print("Generating optimal haptic feedback (10Hz)")
        
        # レイテンシを確認
        time.sleep(1)
        print(f"Average latency: {controller.get_latency_ms():.2f}ms")
        
        time.sleep(5)


if __name__ == "__main__":
    print("=== Basic Example ===")
    # basic_example()
    
    print("\n=== Vector Force Example ===")
    # vector_force_example()
    
    print("\n=== Research-based Example ===")
    # research_based_example()
    
    print("\nNote: Uncomment the examples to run them with actual hardware")