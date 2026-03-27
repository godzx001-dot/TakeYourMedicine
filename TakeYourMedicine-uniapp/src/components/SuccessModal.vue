<template>
  <view class="success-mask" @tap.self="$emit('close')">
    <view class="success-card">
      <view class="success-badge">✓</view>
      <view class="success-title">吃药成功</view>
      <view class="success-desc">已帮你记录，继续保持好习惯</view>
      <button class="success-btn" @click="$emit('close')">知道啦</button>
    </view>
  </view>
</template>

<script>
export default {
  name: 'SuccessModal',
  emits: ['close']
};
</script>

<style lang="scss" scoped>
.success-mask {
  position: fixed;
  inset: 0;
  background: rgba(6, 34, 20, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99;
  backdrop-filter: blur(6rpx);
}

.success-card {
  width: 520rpx;
  border-radius: 32rpx;
  padding: 48rpx 36rpx 40rpx;
  background: #ffffff;
  box-shadow: 0 24rpx 60rpx rgba(3, 55, 39, 0.32);
  text-align: center;
  animation: successPop 0.28s ease;
}

.success-badge {
  width: 92rpx;
  height: 92rpx;
  margin: 0 auto 18rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #25d089 0%, #6cf3c1 100%);
  color: #ffffff;
  font-size: 54rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 14rpx 30rpx rgba(22, 200, 134, 0.35);
}

.success-title {
  font-size: 40rpx;
  font-weight: 800;
  color: #1b5a43;
  margin-bottom: 10rpx;
}

.success-desc {
  font-size: 28rpx;
  color: #6a7f75;
  margin-bottom: 32rpx;
}

.success-btn {
  width: 100%;
  height: 88rpx;
  border-radius: 999rpx;
  border: none;
  font-size: 34rpx;
  font-weight: 700;
  color: #ffffff;
  background: linear-gradient(90deg, #18c884 0%, #2be1a5 100%);
}

.success-btn::after {
  border: none;
}

@keyframes successPop {
  0% {
    transform: scale(0.92);
    opacity: 0.6;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
