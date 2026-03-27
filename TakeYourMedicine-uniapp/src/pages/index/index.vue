<template>
  <view class="page">
    <view class="bg-glow bg-glow-top"></view>
    <view class="bg-glow bg-glow-bottom"></view>

    <view class="card-wrap">
      <view class="hero">
        <view class="hero-title">记得吃药呦~</view>
      </view>

      <view class="content-panel">
        <view class="desc">吃了记得点一下“吃药了”，你好我好大家好</view>

        <view class="time-grid">
          <view
            v-for="slot in timeSlots"
            :key="slot.id"
            class="time-card"
          >
            <view class="slot-title">
              <text>{{ slot.main }}</text>
              <text class="slot-highlight">{{ slot.highlight }}</text>
            </view>
            <view class="pill-row">
              <view
                v-for="(icon, index) in slot.icons"
                :key="`${slot.id}-${index}`"
                class="pill-item"
              >
                <image
                  class="pill-icon"
                  :class="{ 'pill-icon-large': icon && icon.includes('药片') }"
                  :src="icon"
                  mode="aspectFit"
                />
              </view>
            </view>
          </view>
        </view>

        <button
          class="take-btn"
          :disabled="submitting"
          @click="handleTakeMedicine"
        >
          {{ submitting ? '提交中...' : '吃药了' }}
        </button>

        <view class="email-row">
          <text class="email-label">通知邮箱：</text>
          <input
            v-model.trim="email"
            class="email-input"
            type="text"
            placeholder="请输入接收通知的邮箱"
            confirm-type="done"
          />
        </view>
      </view>
    </view>

    <SuccessModal v-if="successVisible" @close="closeSuccess" />
  </view>
</template>

<script>
import { TIME_SLOTS } from '@/common/timeSlots';
import SuccessModal from '@/components/SuccessModal.vue';

export default {
  components: {
    SuccessModal
  },
  data() {
    return {
      email: '',
      submitting: false,
      successVisible: false,
      successTimer: null,
      timeSlots: TIME_SLOTS
    };
  },
  beforeUnmount() {
    if (this.successTimer) {
      clearTimeout(this.successTimer);
      this.successTimer = null;
    }
  },
  methods: {
    validateEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },

    closeSuccess() {
      this.successVisible = false;
      if (this.successTimer) {
        clearTimeout(this.successTimer);
        this.successTimer = null;
      }
    },

    showSuccessModal() {
      this.successVisible = true;
      if (this.successTimer) {
        clearTimeout(this.successTimer);
      }
      this.successTimer = setTimeout(() => {
        this.successVisible = false;
        this.successTimer = null;
      }, 1800);
    },

    async handleTakeMedicine() {
      if (!this.email) {
        uni.showToast({
          title: '请先输入通知邮箱',
          icon: 'none'
        });
        return;
      }

      if (!this.validateEmail(this.email)) {
        uni.showToast({
          title: '邮箱格式不正确',
          icon: 'none'
        });
        return;
      }

      this.submitting = true;
      try {
        const [requestError, response] = await uni.request({
          url: 'https://api.example.com/medicine-events',
          method: 'POST',
          timeout: 12000,
          header: {
            'Content-Type': 'application/json'
          },
          data: {
            email: this.email,
            clickedAt: new Date().toISOString(),
            source: 'mp-weixin'
          }
        });

        if (requestError || !response || response.statusCode < 200 || response.statusCode >= 300) {
          throw new Error('request failed');
        }

        this.showSuccessModal();
      } catch (error) {
        uni.showToast({
          title: '提交失败，请稍后重试',
          icon: 'none'
        });
      } finally {
        this.submitting = false;
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #ebfff8 0%, #c8ffe9 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(40rpx);
  z-index: 0;
}

.bg-glow-top {
  width: 360rpx;
  height: 360rpx;
  top: -120rpx;
  left: -40rpx;
  background: rgba(53, 236, 173, 0.58);
}

.bg-glow-bottom {
  width: 380rpx;
  height: 380rpx;
  right: -90rpx;
  bottom: -100rpx;
  background: rgba(35, 214, 164, 0.45);
}

.card-wrap {
  position: relative;
  z-index: 2;
  border-radius: 34rpx;
  background: linear-gradient(145deg, #11cc88 0%, #17e0a5 66%, #11c794 100%);
  box-shadow: 0 18rpx 50rpx rgba(11, 157, 109, 0.3);
  padding-bottom: 18rpx;
  margin-top: 16rpx;
}

.hero {
  min-height: 200rpx;
  padding: 54rpx 36rpx 24rpx;
  border-top-left-radius: 34rpx;
  border-top-right-radius: 34rpx;
  background: linear-gradient(100deg, #12d08d 0%, #52e9ae 48%, #2ad6a8 100%);
  position: relative;
  display: flex;
  align-items: center;
}

.hero::after {
  content: '';
  position: absolute;
  right: 28rpx;
  bottom: 0;
  width: 128rpx;
  height: 128rpx;
  border-radius: 28rpx 28rpx 0 0;
  background: rgba(255, 255, 255, 0.22);
}

.hero-title {
  width: 100%;
  text-align: center;
  font-size: 66rpx;
  line-height: 1.1;
  color: #f4fff9;
  font-weight: 900;
  text-shadow: 0 8rpx 18rpx rgba(8, 132, 88, 0.32);
  padding-right: 100rpx;
}

.content-panel {
  margin: 0 18rpx;
  margin-top: -8rpx;
  border-radius: 28rpx;
  background: #f6f6f7;
  padding: 32rpx 26rpx 40rpx;
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.6);
}

.desc {
  font-size: 28rpx;
  line-height: 1.42;
  color: #9a9aa8;
  text-align: center;
  margin-bottom: 34rpx;
  font-weight: 600;
}

.time-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
}

.time-card {
  background: #f2efdf;
  border-radius: 18rpx;
  padding: 18rpx;
  min-height: 186rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
}

.slot-title {
  font-size: 42rpx;
  line-height: 1.25;
  font-weight: 800;
  color: #e5962f;
  text-align: center;
  width: 100%;
}

.slot-highlight {
  color: #e52929;
  margin-left: 4rpx;
}

.pill-row {
  display: flex;
  align-items: center;
  justify-content: center;
  column-gap: 12rpx;
}

.pill-item {
  width: 92rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pill-icon {
  width: 76rpx;
  height: 50rpx;
}

.pill-icon-large {
  width: 156rpx;
  height: 118rpx;
}

.take-btn {
  margin-top: 52rpx;
  width: 100%;
  height: 118rpx;
  border-radius: 999rpx;
  border: none;
  font-size: 70rpx;
  font-weight: 900;
  color: #f2fff9;
  background: linear-gradient(90deg, #1ec89a 0%, #2df37a 100%);
  box-shadow: 0 14rpx 34rpx rgba(13, 207, 149, 0.36);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  text-align: center;
}

.take-btn::after {
  border: none;
}

.take-btn[disabled] {
  opacity: 0.7;
}

.email-row {
  margin-top: 28rpx;
}

.email-label {
  display: block;
  font-size: 32rpx;
  color: #8b8b99;
  margin-bottom: 14rpx;
}

.email-input {
  height: 82rpx;
  border-radius: 18rpx;
  padding: 0 24rpx;
  font-size: 30rpx;
  color: #4e4e56;
  background-color: #ffffff;
  border: 2rpx solid #e6ece9;
}

</style>
