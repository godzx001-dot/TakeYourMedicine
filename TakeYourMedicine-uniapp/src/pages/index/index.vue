<template>
  <view class="page">
    <view class="hero-wrap">
      <view class="hero-profile">
        <image v-if="profileAvatarUrl" class="hero-avatar" :src="profileAvatarUrl" mode="aspectFill" />
        <text class="hero-name">{{ profileNickname || '朋友' }}</text>
      </view>
      <view class="hero-title">记得吃药呦~</view>
      <view class="hero-dog-wrap">
        <image class="hero-dog" :src="dogImage" mode="aspectFill" />
      </view>
    </view>

    <view class="content-panel">
      <view class="desc">吃了记得点一下“吃药了”，你好我好大家好</view>

      <view class="middle-stage-zone">
        <view class="stage-tip-bar">
          <view class="stage-tip-texts">
            <text class="stage-tip-main">下次吃药时间：{{ nextDoseTimeText }}</text>
          </view>
        </view>

        <view class="stage-swiper-wrap">
          <swiper
            class="stage-swiper"
            :current="currentStageIndex"
            @change="handleStageChange"
            :indicator-dots="false"
            :autoplay="false"
            :circular="false"
            :disable-touch="false"
            :touchable="true"
            previous-margin="26rpx"
            next-margin="26rpx"
          >
            <swiper-item v-for="(stage, idx) in displayedStageList" :key="stage.key">
              <view class="stage-card" :class="{ 'is-current': idx === currentStageIndex }">
                <template v-if="stage.isComplete">
                  <view class="complete-card">
                    <text class="complete-title">今天非常棒</text>
                    <text class="complete-subtitle">明天继续</text>
                  </view>
                </template>
                <template v-else>
                  <view class="group-card" :class="{ 'is-gray': stage.isGray }">
                    <view class="group-label">
                      <text class="label-meal">{{ stage.meal }}</text>
                      <text class="label-action">{{ stage.action }}</text>
                    </view>
                    <view class="pills-row" :class="getPillsRowClass(stage)">
                      <view v-for="item in stage.items" :key="`${stage.key}-${item.name}`" class="pill-item">
                        <image class="pill-icon" :class="getPillIconClass(item)" :src="item.icon" mode="aspectFit" @error="handlePillIconError(item)" />
                        <text class="pill-name">{{ item.label || item.name }}</text>
                        <text class="pill-count">x{{ item.count }}</text>
                      </view>
                    </view>
                  </view>
                </template>
              </view>
            </swiper-item>
          </swiper>
        </view>
      </view>

      <view class="stage-indicators">
        <view
          v-for="(stage, idx) in displayedStageList"
          :key="`${stage.key}-dot`"
          class="indicator-dot"
          :class="{
            'is-active': idx === currentStageIndex,
            'is-complete': !stage.isComplete && stage.isGray
          }"
        />
      </view>

      <view class="page-footer">
        <button class="take-btn" :class="{ 'is-disabled': isTakeButtonDisabled }" :disabled="isTakeButtonDisabled" @click="handleTakeMedicine">
          {{ submitting ? '提交中...' : '吃药了' }}
        </button>

        <view class="email-row">
          <text class="email-label">通知邮箱：</text>
          <view v-if="savedEmailsText" class="email-saved">{{ savedEmailsText }}</view>
          <input
            v-else
            v-model.trim="emailsInput"
            class="email-input"
            type="text"
            placeholder="多个邮箱请用英文逗号分隔"
            confirm-type="done"
          />
        </view>
      </view>
    </view>

    <view v-if="profileSheetVisible" class="profile-sheet-mask">
      <view class="profile-sheet" @tap.stop>
        <view class="profile-sheet-title">完善资料</view>
        <view class="profile-sheet-subtitle">请先设置微信头像和昵称</view>
        <button class="sheet-avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
          <image v-if="profileAvatarUrl" class="sheet-avatar-image" :src="profileAvatarUrl" mode="aspectFill" />
          <text v-else>选择微信头像</text>
        </button>
        <input
          v-model.trim="profileNickname"
          class="sheet-nickname-input"
          type="nickname"
          placeholder="请输入微信昵称"
          confirm-type="done"
          @blur="onNicknameBlur"
        />
        <button class="sheet-confirm-btn" @click="confirmProfileSheet">确认并继续</button>
      </view>
    </view>

    <SuccessModal v-if="successVisible" @close="closeSuccess" />
  </view>
</template>

<script>
import SuccessModal from '@/components/SuccessModal.vue';
import bigTabletIcon from '@/static/images/big_tablet.svg';
import midTabletIcon from '@/static/images/mid_tablet.svg';
import smallTabletIcon from '@/static/images/small_tablet.svg';
import redCapsuleIcon from '@/static/images/red_capsule.svg';
import greenCapsuleIcon from '@/static/images/green_capsule.svg';
import yellowTabletIcon from '@/static/images/yellow_tablet.svg';
import ovalTabletIcon from '@/static/images/oval_tablet.svg';
import titleDogIcon from '@/static/images/title_dog.png';

const ICONS = {
  bigTablet: bigTabletIcon,
  midTablet: midTabletIcon,
  smallTablet: smallTabletIcon,
  redCapsule: redCapsuleIcon,
  greenCapsule: greenCapsuleIcon,
  yellowTablet: yellowTabletIcon,
  ovalTablet: ovalTabletIcon,
  dog: titleDogIcon
};

const FALLBACK_ICON = titleDogIcon;
const API_BASE = process.env.VUE_APP_API_BASE || 'https://example.com';
const CLOUDBASE_ENV = process.env.VUE_APP_CLOUDBASE_ENV || 'your-cloudbase-env-id';
const CLOUDBASE_SERVICE = process.env.VUE_APP_CLOUDBASE_SERVICE || 'your-cloudbase-service';

export default {
  components: {
    SuccessModal
  },
  computed: {
    displayedStageList() {
      return this.stageList.filter((stage) => !stage.isComplete || this.showDoneStage);
    },
    currentStage() {
      return this.displayedStageList[this.currentStageIndex] || {};
    },
    currentStageTitle() {
      const current = this.currentStage;
      if (current.isComplete) return '今天非常棒，明天继续';
      const meal = current.meal || '';
      const action = current.action || '';
      return `${meal}-${action}`;
    },
    nextDoseTimeText() {
      return this.getNextDoseTimeLabel();
    },
    isTakeButtonDisabled() {
      if (this.submitting) return true;
      if (this.currentStage?.isComplete) return true;
      return Boolean(this.currentStage?.isGray);
    }
  },
  data() {
    return {
      emailsInput: '',
      savedEmails: [],
      savedEmailsText: '',
      profileNickname: '',
      profileAvatarUrl: '',
      profileSheetVisible: false,
      submitting: false,
      successVisible: false,
      successTimer: null,
      dogImage: ICONS.dog,
      currentStageIndex: 0,
      showDoneStage: false,
      stageList: [
        {
          key: 'morning-before',
          period: 'morning',
          meal: '早饭',
          action: '饭前吃',
          code: 'AM',
          items: [
            { name: 'midTablet', label: '阿司匹林肠溶片', icon: ICONS.smallTablet, count: 1 },
            { name: 'ovalTablet', label: '泮托拉唑钠肠溶片', icon: ICONS.ovalTablet, count: 1 }
          ],
          isGray: false
        },
        {
          key: 'morning-with',
          period: 'morning',
          meal: '早饭',
          action: '随餐吃',
          code: 'AM',
          items: [
            { name: 'bigTablet', label: '二甲双胍', icon: ICONS.bigTablet, count: 2 },
            { name: 'smallTablet', label: '尼麦角林', icon: ICONS.smallTablet, count: 2 },
            { name: 'yellowTablet', label: '美金刚', icon: ICONS.yellowTablet, count: 1 },
            { name: 'redCapsule', label: '血脂康', icon: ICONS.redCapsule, count: 2 },
            { name: 'greenCapsule', label: '心元胶囊', icon: ICONS.greenCapsule, count: 3 }
          ],
          isGray: false
        },
        {
          key: 'noon-after',
          period: 'noon',
          meal: '中午',
          action: '饭后吃',
          code: 'MID',
          items: [
            { name: 'smallTablet', label: '尼麦角林', icon: ICONS.smallTablet, count: 2 },
            { name: 'greenCapsule', label: '心元胶囊', icon: ICONS.greenCapsule, count: 3 }
          ],
          isGray: false
        },
        {
          key: 'night-with',
          period: 'night',
          meal: '晚上',
          action: '随餐吃',
          code: 'NIGHT',
          items: [{ name: 'bigTablet', label: '二甲双胍', icon: ICONS.bigTablet, count: 2 }],
          isGray: false
        },
        {
          key: 'night-after',
          period: 'night',
          meal: '晚上',
          action: '饭后吃',
          code: 'NIGHT',
          items: [
            { name: 'smallTablet', label: '尼麦角林', icon: ICONS.smallTablet, count: 2 },
            { name: 'greenCapsule', label: '心元胶囊', icon: ICONS.greenCapsule, count: 3 },
            { name: 'redCapsule', label: '血脂康', icon: ICONS.redCapsule, count: 2 }
          ],
          isGray: false
        },
        {
          key: 'night-before-bed',
          period: 'night',
          meal: '晚上',
          action: '睡前吃',
          code: 'NIGHT',
          items: [
            { name: 'midTablet', label: '多奈哌齐', icon: ICONS.midTablet, count: 2 },
            { name: 'midTablet', label: '阿托伐他汀', icon: ICONS.bigTablet, count: 1 }
          ],
          isGray: false
        },
        {
          key: 'done-today',
          isComplete: true
        }
      ]
    };
  },
  async onLoad() {
    await this.refreshPageState();
  },
  async onShow() {
    await this.refreshPageState();
  },
  beforeUnmount() {
    if (this.successTimer) {
      clearTimeout(this.successTimer);
      this.successTimer = null;
    }
  },
  methods: {
    async refreshPageState() {
      const cachedEmails = uni.getStorageSync('notification_emails');
      const parsedEmails = Array.isArray(cachedEmails)
        ? cachedEmails.filter((item) => this.validateEmail(item))
        : [];

      if (parsedEmails.length > 0) {
        this.savedEmails = parsedEmails;
        this.savedEmailsText = parsedEmails.join('，');
        this.emailsInput = parsedEmails.join(',');
      }

      const cachedProfile = uni.getStorageSync('wx_profile') || {};
      this.profileNickname = cachedProfile?.nickname || '';
      this.profileAvatarUrl = cachedProfile?.avatarUrl || '';
      this.profileSheetVisible = !this.profileNickname;

      try {
        await this.ensureWechatLogin();
      } catch (error) {
        const detail = this.formatErrorDetail(error);
        console.error('[wechat login failed]', error, detail);
        uni.showModal({
          title: '初始化异常',
          content: `登录接口返回异常，请截图反馈\n${detail}`,
          showCancel: false
        });
      }

      await this.updateGrayState();
    },
    handlePillIconError(item) {
      if (!item || item.icon === FALLBACK_ICON) return;
      item.icon = FALLBACK_ICON;
    },

    getPillsRowClass(stage) {
      const count = Array.isArray(stage?.items) ? stage.items.length : 0;
      const classes = [];

      if (count >= 5) classes.push('is-dense');
      if (count <= 3) classes.push('is-large');
      if (count >= 4 && count <= 5) classes.push('is-medium');

      if (stage?.key === 'morning-with') {
        classes.push('is-two-rows');
      }

      return classes;
    },

    getPillIconClass(item) {
      if (!item?.name) return '';
      if (item.name === 'bigTablet') return 'is-scale-120';
      if (item.name === 'smallTablet') return 'is-scale-55';
      return 'is-scale-85';
    },

    validateEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },

    parseEmails(input) {
      if (!input) return [];
      const values = String(input)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      return Array.from(new Set(values));
    },

    formatErrorDetail(error) {
      if (!error) return '未知错误';
      if (typeof error === 'string') return error;
      const message = error?.message || error?.errMsg;
      if (message) return String(message);
      try {
        return JSON.stringify(error);
      } catch (_e) {
        return String(error);
      }
    },

    persistProfile() {
      uni.setStorageSync('wx_profile', {
        nickname: this.profileNickname || '',
        avatarUrl: this.profileAvatarUrl || ''
      });
    },

    onNicknameBlur() {
      this.profileNickname = String(this.profileNickname || '').trim();
      this.persistProfile();
    },

    async uploadAvatarToCloud(localPath) {
      if (!localPath) return '';
      // #ifdef MP-WEIXIN
      if (!wx?.cloud?.uploadFile) return '';
      const openid = uni.getStorageSync('openid') || 'anonymous';
      const extMatch = String(localPath).match(/\.(png|jpg|jpeg|webp)$/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'png';
      const cloudPath = `avatars/${openid}/${Date.now()}.${ext}`;

      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: localPath
      });

      return uploadRes?.fileID || '';
      // #endif
    },

    async onChooseAvatar(event) {
      const avatarUrl = event?.detail?.avatarUrl || '';
      if (!avatarUrl) return;

      this.profileAvatarUrl = avatarUrl;
      this.persistProfile();

      const isTempAvatar = /(^http:\/\/tmp\/)|(^wxfile:\/\/)/.test(String(avatarUrl));
      if (!isTempAvatar) return;

      try {
        const fileId = await this.uploadAvatarToCloud(avatarUrl);
        if (fileId) {
          this.profileAvatarUrl = fileId;
          this.persistProfile();
          uni.showToast({ title: '头像已上传云端', icon: 'none' });
          return;
        }
      } catch (error) {
        console.warn('[avatar upload failed]', error);
      }

      uni.showToast({
        title: '头像为临时地址，仅本地显示',
        icon: 'none'
      });
    },

    confirmProfileSheet() {
      this.profileNickname = String(this.profileNickname || '').trim();
      if (!this.profileNickname) {
        uni.showToast({ title: '请先填写昵称', icon: 'none' });
        return;
      }
      this.persistProfile();
      this.profileSheetVisible = false;
    },

    async ensureWechatLogin() {
      // #ifdef MP-WEIXIN
      console.log('[auth] ensureWechatLogin:start');
      if (!wx?.login) {
        console.warn('[auth] wx.login not available');
        return;
      }

      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        });
      });
      console.log('[auth] wx.login result', { hasCode: Boolean(loginRes?.code) });

      if (!loginRes?.code) {
        throw new Error('wx.login 未返回 code');
      }

      console.log('[auth] call wechat-login');
      let loginErr = null;
      let loginResp = null;

      if (wx?.cloud?.callContainer) {
        try {
          const resp = await wx.cloud.callContainer({
            config: { env: CLOUDBASE_ENV },
            path: '/api/v1/auth/wechat-login',
            method: 'POST',
            header: {
              'content-type': 'application/json',
              'X-WX-SERVICE': CLOUDBASE_SERVICE
            },
            data: { code: loginRes.code }
          });
          loginResp = { statusCode: 200, data: resp?.data || {} };
        } catch (e) {
          loginErr = e;
        }
      }

      if (!loginResp) {
        const loginReq = await uni.request({
          url: `${API_BASE}/api/v1/auth/wechat-login`,
          method: 'POST',
          timeout: 12000,
          header: { 'Content-Type': 'application/json' },
          data: { code: loginRes.code }
        });
        const tuple = Array.isArray(loginReq) ? loginReq : [null, loginReq];
        loginErr = tuple[0];
        loginResp = tuple[1];
      }
      console.log('[auth] wechat-login response', {
        err: loginErr?.errMsg,
        statusCode: loginResp?.statusCode,
        code: loginResp?.data?.code,
        message: loginResp?.data?.message,
        traceId: loginResp?.data?.traceId
      });
      if (loginErr || !loginResp?.data?.data?.openid) {
        const backend = loginResp?.data || {};
        const detail = {
          errMsg: loginErr?.errMsg,
          statusCode: loginResp?.statusCode,
          code: backend?.code,
          message: backend?.message,
          traceId: backend?.traceId
        };
        console.error('[auth] wechat-login failed detail', detail);
        throw detail;
      }

      uni.setStorageSync('openid', loginResp.data.data.openid);
      // 用户资料授权需在用户手势内触发（见 ensureWechatProfile）
      // #endif
    },

    async ensureWechatProfile() {
      // #ifdef MP-WEIXIN
      console.log('[auth] ensureWechatProfile:start');

      const cachedProfile = uni.getStorageSync('wx_profile') || {};
      if (cachedProfile?.nickname) return;
      if (!wx?.getUserProfile) return;

      const profileRes = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于记录吃药打卡用户信息',
          success: resolve,
          fail: reject
        });
      });

      const { rawData, signature, userInfo } = profileRes || {};
      console.log('[auth] getUserProfile result', {
        hasUserInfo: Boolean(userInfo),
        hasSignature: Boolean(signature)
      });
      if (!userInfo) return;

      // 先本地落盘昵称，避免签名校验失败时拿不到昵称
      const currentOpenid = uni.getStorageSync('openid') || '';
      uni.setStorageSync('wx_profile', {
        nickname: userInfo.nickName || cachedProfile?.nickname || '',
        avatarUrl: userInfo.avatarUrl || cachedProfile?.avatarUrl || ''
      });

      if (rawData && signature) {
        console.log('[auth] call wechat-verify-profile', { openid: (currentOpenid || '').slice(0, 8) });

        let verifyErr = null;
        let verifyResp = null;

        if (wx?.cloud?.callContainer) {
          try {
            const resp = await wx.cloud.callContainer({
              config: { env: CLOUDBASE_ENV },
              path: '/api/v1/auth/wechat-verify-profile',
              method: 'POST',
              header: {
                'content-type': 'application/json',
                'X-WX-SERVICE': CLOUDBASE_SERVICE
              },
              data: { openid: currentOpenid, rawData, signature, userInfo }
            });
            verifyResp = { statusCode: 200, data: resp?.data || {} };
          } catch (e) {
            verifyErr = e;
          }
        }

        if (!verifyResp) {
          const req = await uni.request({
            url: `${API_BASE}/api/v1/auth/wechat-verify-profile`,
            method: 'POST',
            timeout: 12000,
            header: { 'Content-Type': 'application/json' },
            data: { openid: currentOpenid, rawData, signature, userInfo }
          });
          const tuple = Array.isArray(req) ? req : [null, req];
          verifyErr = tuple[0];
          verifyResp = tuple[1];
        }

        console.log('[auth] wechat-verify-profile response', {
          err: verifyErr?.errMsg,
          statusCode: verifyResp?.statusCode,
          code: verifyResp?.data?.code,
          message: verifyResp?.data?.message,
          traceId: verifyResp?.data?.traceId
        });

        if (verifyErr || Number(verifyResp?.data?.code) !== 0) {
          const backend = verifyResp?.data || {};
          console.warn('[wechat verify failed but keep local profile]', {
            message: backend?.message || verifyErr?.errMsg,
            code: backend?.code,
            traceId: backend?.traceId
          });
          return;
        }

        uni.setStorageSync('wx_profile', {
          nickname: verifyResp?.data?.data?.nickname || userInfo.nickName || '',
          avatarUrl: verifyResp?.data?.data?.avatarUrl || userInfo.avatarUrl || ''
        });
      }
      // #endif
    },

    async fetchTodaySlots() {
      const openid = uni.getStorageSync('openid') || `email:${this.savedEmails[0] || 'anonymous'}`;
      let requestError = null;
      let response = null;

      // #ifdef MP-WEIXIN
      if (wx?.cloud?.callContainer) {
        try {
          const resp = await wx.cloud.callContainer({
            config: { env: CLOUDBASE_ENV },
            path: '/api/v1/dose-slots/today?timezone=Asia/Shanghai',
            method: 'GET',
            header: {
              'X-WX-SERVICE': CLOUDBASE_SERVICE,
              'x-user-openid': openid
            }
          });
          response = { statusCode: 200, data: resp?.data || {} };
        } catch (e) {
          requestError = e;
          console.warn('[slots] callContainer failed, fallback to https', e);
        }
      }
      // #endif

      if (!response) {
        const requestResult = await uni.request({
          url: `${API_BASE}/api/v1/dose-slots/today?timezone=Asia/Shanghai`,
          method: 'GET',
          timeout: 12000,
          header: {
            'x-user-openid': openid
          }
        });

        const tuple = Array.isArray(requestResult) ? requestResult : [null, requestResult];
        requestError = tuple[0];
        response = tuple[1];
      }

      if (requestError || !response || response.statusCode < 200 || response.statusCode >= 300) {
        console.warn('[slots] fetch failed', {
          err: requestError?.errMsg,
          statusCode: response?.statusCode,
          code: response?.data?.code,
          message: response?.data?.message,
          traceId: response?.data?.traceId
        });
        return [];
      }

      const resData = response.data || {};
      if (Number(resData.code) !== 0) {
        console.warn('[slots] business failed', {
          code: resData?.code,
          message: resData?.message,
          traceId: resData?.traceId
        });
        return [];
      }
      return Array.isArray(resData?.data?.slots) ? resData.data.slots : [];
    },

    getNowBeijingDate() {
      const now = new Date();
      const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
      return new Date(utcMs + 8 * 60 * 60 * 1000);
    },

    getCurrentTimePhase() {
      const beijingHour = this.getNowBeijingDate().getHours();
      if (beijingHour < 11) return 'morning';
      if (beijingHour < 14) return 'noon';
      return 'afternoon';
    },

    getNextDoseTimeLabel() {
      const h = this.getNowBeijingDate().getHours();
      if (h < 9) return '09:00（早饭饭前）';
      if (h < 12) return '12:00（中午饭后）';
      if (h < 18) return '18:00（晚上随餐）';
      return '明天 09:00（早饭饭前）';
    },

    getNowTimeText() {
      const d = this.getNowBeijingDate();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    },

    getCurrentStageIndex() {
      const phase = this.getCurrentTimePhase();
      if (phase === 'morning') return 0;
      if (phase === 'noon') return 2;
      return 3;
    },

    getExpectedStageKeyByPhase(phase) {
      if (phase === 'morning') return 'morning-before';
      if (phase === 'noon') return 'noon-after';
      return 'night-with';
    },

    getPhaseStageKeys(phase) {
      if (phase === 'morning') return ['morning-before', 'morning-with'];
      if (phase === 'noon') return ['noon-after'];
      return ['night-with', 'night-after', 'night-before-bed'];
    },

    getPhaseNextStageIndex() {
      const phaseOrder = ['morning', 'noon', 'afternoon'];
      const currentPhase = this.getCurrentTimePhase();
      const start = phaseOrder.indexOf(currentPhase);
      const sortedPhases = [...phaseOrder.slice(start), ...phaseOrder.slice(0, start)];

      for (const phase of sortedPhases) {
        const keys = this.getPhaseStageKeys(phase);
        const nextNotGrayIndex = this.displayedStageList.findIndex(
          (stage) => !stage.isComplete && keys.includes(stage.key) && !stage.isGray
        );
        if (nextNotGrayIndex >= 0) return nextNotGrayIndex;
      }

      return this.getCurrentStageIndex();
    },

    async updateGrayState() {
      const slots = await this.fetchTodaySlots();

      const clickCountByCode = slots.reduce((acc, item) => {
        const code = item?.doseTypeCode;
        if (!code) return acc;
        if (typeof item?.clickCount === 'number') {
          acc[code] = Number(item.clickCount || 0);
          return acc;
        }
        if (item?.status === 'DONE') {
          acc[code] = (acc[code] || 0) + 1;
        }
        return acc;
      }, {});

      const doneTotal = {
        AM: Number(clickCountByCode.AM || 0),
        MID: Number(clickCountByCode.MID || 0),
        NIGHT: Number(clickCountByCode.NIGHT || 0)
      };

      this.stageList = this.stageList.map((stage) => {
        if (stage.isComplete) return stage;

        const doneCount = Number(doneTotal[stage.code] || 0);
        const thresholds = {
          'morning-before': 1,
          'morning-with': 2,
          'noon-after': 1,
          'night-with': 1,
          'night-after': 2,
          'night-before-bed': 3
        };

        return {
          ...stage,
          isGray: doneCount >= Number(thresholds[stage.key] || 999)
        };
      });

      this.showDoneStage = doneTotal.AM >= 2 && doneTotal.MID >= 1 && doneTotal.NIGHT >= 3;

      if (this.showDoneStage) {
        this.currentStageIndex = Math.max(0, this.displayedStageList.length - 1);
        return;
      }

      const targetIndex = this.getPhaseNextStageIndex();
      const maxIndex = Math.max(0, this.displayedStageList.length - 1);
      this.currentStageIndex = Math.max(0, Math.min(targetIndex, maxIndex));
    },

    handleStageChange(event) {
      const nextIndex = Number(event?.detail?.current || 0);
      const maxIndex = Math.max(0, this.displayedStageList.length - 1);
      this.currentStageIndex = Math.max(0, Math.min(nextIndex, maxIndex));
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

    async requestMedicineEvent(activeEmails) {
      const nickname = String(this.profileNickname || '').trim();
      const avatarUrl = String(this.profileAvatarUrl || '').trim();
      this.persistProfile();

      const payload = {
        email: activeEmails[0],
        emails: activeEmails,
        clickedAt: new Date().toISOString(),
        source: 'mp-weixin',
        doseTypeCode: this.currentStage?.code
      };

      if (nickname) {
        payload.nickname = nickname;
      }
      if (avatarUrl) {
        payload.avatarUrl = avatarUrl;
      }
      const openid = uni.getStorageSync('openid') || `email:${activeEmails[0] || 'anonymous'}`;

      // #ifdef MP-WEIXIN
      if (wx?.cloud?.callContainer) {
        try {
          const containerResp = await wx.cloud.callContainer({
            config: { env: CLOUDBASE_ENV },
            path: '/api/v1/medicine-events',
            method: 'POST',
            header: {
              'content-type': 'application/json',
              'X-WX-SERVICE': CLOUDBASE_SERVICE,
              'x-user-openid': openid
            },
            data: payload
          });

          const data = containerResp?.data || {};
          if (Number(data.code) !== 0) {
            throw new Error(data.message || '业务处理失败');
          }
          return data;
        } catch (cloudError) {
          console.error('[callContainer failed, fallback to https]', cloudError);
        }
      }
      // #endif

      const requestResult = await uni.request({
        url: `${API_BASE}/api/v1/medicine-events`,
        method: 'POST',
        timeout: 12000,
        header: {
          'Content-Type': 'application/json',
          'x-user-openid': openid
        },
        data: payload
      });

      const [requestError, response] = Array.isArray(requestResult)
        ? requestResult
        : [null, requestResult];

      if (requestError) {
        throw new Error(`提交失败: ${requestError.errMsg || '网络请求失败'}`);
      }

      if (!response || response.statusCode < 200 || response.statusCode >= 300) {
        const backend = response?.data || {};
        throw new Error(`提交失败: ${backend?.code || response?.statusCode || ''} ${backend?.message || `HTTP ${response?.statusCode || 'UNKNOWN'}`} ${backend?.traceId ? `(traceId:${backend.traceId})` : ''}`.trim());
      }

      const resData = response.data || {};
      if (Number(resData.code) !== 0) {
        throw new Error(`提交失败: ${resData?.code || ''} ${resData.message || '业务处理失败'} ${resData?.traceId ? `(traceId:${resData.traceId})` : ''}`.trim());
      }
      return resData;
    },

    async handleTakeMedicine() {
      const activeEmails = this.savedEmails.length > 0
        ? this.savedEmails
        : this.parseEmails(this.emailsInput);

      if (activeEmails.length === 0) {
        uni.showToast({ title: '请先输入通知邮箱', icon: 'none' });
        return;
      }

      const invalidEmail = activeEmails.find((item) => !this.validateEmail(item));
      if (invalidEmail) {
        uni.showToast({ title: '邮箱格式不正确', icon: 'none' });
        return;
      }

      const nickname = String(this.profileNickname || '').trim();
      if (!nickname) {
        uni.showToast({ title: '请先填写昵称', icon: 'none' });
        return;
      }

      const expectedStageIndex = this.showDoneStage
        ? Math.max(0, this.displayedStageList.length - 1)
        : this.getPhaseNextStageIndex();
      if (Number(this.currentStageIndex) !== Number(expectedStageIndex)) {
        const expectedStage = this.displayedStageList[expectedStageIndex] || {};
        const expectedTitle = expectedStage?.isComplete
          ? '今天非常棒'
          : `${expectedStage?.meal || ''}${expectedStage?.action || ''}`;

        const choice = await new Promise((resolve) => {
          uni.showModal({
            title: '时间提醒',
            content: `当前时间是 ${this.getNowTimeText()}，建议打卡“${expectedTitle}”。`,
            confirmText: '确定',
            cancelText: '继续提交',
            success: (res) => resolve(res)
          });
        });

        if (choice?.confirm) {
          const maxIndex = Math.max(0, this.displayedStageList.length - 1);
          this.currentStageIndex = Math.max(0, Math.min(expectedStageIndex, maxIndex));
          return;
        }
      }

      this.submitting = true;
      try {
        await this.requestMedicineEvent(activeEmails);
        await this.refreshPageState();
        this.showSuccessModal();
        if (this.savedEmails.length === 0) {
          uni.setStorageSync('notification_emails', activeEmails);
          this.savedEmails = activeEmails;
          this.savedEmailsText = activeEmails.join('，');
          this.emailsInput = activeEmails.join(',');
        }
      } catch (error) {
        const msg = String(error?.message || '提交失败，请稍后重试');
        uni.showModal({
          title: '提交失败',
          content: msg,
          showCancel: false
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
  background: linear-gradient(180deg, #20d08f 0%, #20d08f 23%, #e9eceb 23%, #eef0ef 100%);
  padding: calc(var(--status-bar-height) + 36rpx) 24rpx 34rpx;
  box-sizing: border-box;
}

.hero-wrap {
  min-height: 280rpx;
  border-radius: 26rpx 26rpx 0 0;
  background: linear-gradient(180deg, #20d08f 0%, #20d08f 55%, #20d08f 100%);
  padding: 32rpx 24rpx 18rpx;
  box-sizing: border-box;
  position: relative;
  box-shadow: 0 14rpx 34rpx rgba(17, 176, 125, 0.22);
}

.hero-profile {
  display: flex;
  align-items: center;
  max-width: calc(100% - 8rpx);
  margin-bottom: 18rpx;
}

.hero-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  margin-right: 12rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.9);
  flex: 0 0 auto;
}

.hero-name {
  font-size: 30rpx;
  color: #ecfff7;
  font-weight: 700;
  max-width: 420rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero-title {
  font-size: 64rpx;
  color: #ecfff7;
  font-weight: 800;
  line-height: 1.1;
  text-shadow: 0 8rpx 18rpx rgba(12, 125, 88, 0.26);
  max-width: 66%;
  margin-bottom: 20rpx;
}

.hero-dog-wrap {
  position: absolute;
  right: 24rpx;
  bottom: 12rpx;
  width: 228rpx;
  height: 182rpx;
  overflow: hidden;
  border-bottom-left-radius: 20rpx;
}

.hero-dog {
  width: 228rpx;
  height: 196rpx;
  flex: 0 0 auto;
}

.content-panel {
  background: #f6f7f7;
  border-radius: 26rpx;
  margin-top: -6rpx;
  padding: 28rpx 24rpx 18rpx;
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  min-height: 1040rpx;
}

.middle-stage-zone {
  height: clamp(calc(620rpx - 40px), calc(52vh - 40px), calc(920rpx - 40px));
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.desc {
  color: #8d939b;
  font-size: 31rpx;
  text-align: center;
  line-height: 1.76;
  margin: 18rpx 0 20rpx;
  font-weight: 500;
}

.profile-sheet-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: flex-end;
  z-index: 40;
}

.profile-sheet {
  width: 100%;
  background: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 28rpx 28rpx 36rpx;
  box-shadow: 0 -12rpx 24rpx rgba(0, 0, 0, 0.08);
}

.profile-sheet-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #0f2d22;
}

.profile-sheet-subtitle {
  margin-top: 8rpx;
  font-size: 26rpx;
  color: #6f7f79;
}

.sheet-avatar-btn {
  margin-top: 22rpx;
  height: 96rpx;
  border-radius: 24rpx;
  border: 2rpx dashed #bfead7;
  background: #f6fffb;
  color: #18a874;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}

.sheet-avatar-btn::after {
  border: none;
}

.sheet-avatar-image {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
}

.sheet-nickname-input {
  margin-top: 18rpx;
  height: 86rpx;
  border-radius: 20rpx;
  padding: 0 24rpx;
  border: 2rpx solid #e2efe9;
  background: #fbfdfc;
  font-size: 30rpx;
  color: #1f3a33;
}

.sheet-confirm-btn {
  margin-top: 22rpx;
  height: 88rpx;
  border-radius: 999rpx;
  background: linear-gradient(90deg, #16c187 0%, #2bd49a 100%);
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 700;
}

.sheet-confirm-btn::after {
  border: none;
}

.stage-tip-bar {
  margin: 8rpx 10rpx 12rpx;
  padding: 16rpx 20rpx;
  border-radius: 999rpx;
  background: #fff3f3;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #ffd6d6;
  box-shadow: none;
}

.stage-tip-texts {
  min-width: 0;
}

.stage-tip-main {
  font-size: 30rpx;
  color: #d92c2c;
  font-weight: 700;
  white-space: nowrap;
}

.stage-swiper-wrap {
  margin: 4rpx 0 10rpx;
  flex: 1;
  position: relative;
}

.stage-swiper {
  height: 100%;
  min-height: 0;
}

.stage-card {
  height: 100%;
  min-height: 0;
  padding: 0 12rpx;
  box-sizing: border-box;
  transform: scale(0.98);
  transition: transform 0.2s ease;
}

.stage-card.is-current {
  transform: scale(1);
}

.complete-card {
  height: 100%;
  border-radius: 18rpx;
  background: linear-gradient(120deg, #ecfff7 0%, #d8ffe9 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-shadow: inset 0 0 0 2rpx #b8f2d4;
}

.complete-title {
  font-size: 54rpx;
  color: #14b378;
  font-weight: 800;
  line-height: 1.2;
}

.complete-subtitle {
  margin-top: 14rpx;
  font-size: 38rpx;
  color: #33b987;
  font-weight: 600;
}

.group-card {
  background: #f3f0e6;
  border-radius: 18rpx;
  height: 100%;
  min-height: 0;
  padding: 24rpx 18rpx 18rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: all 0.2s ease;
  overflow: hidden;
}

.group-card.is-gray {
  background: #e5e5e5;
  filter: grayscale(100%);
  opacity: 0.72;
}

.group-label {
  text-align: center;
  margin-bottom: 14rpx;
  line-height: 1;
  flex: 0 0 auto;
}

.label-meal {
  font-size: 52rpx;
  color: #df9a39;
  font-weight: 600;
  display: inline-block;
  transform: translateY(1rpx);
}

.label-action {
  font-size: 58rpx;
  color: #e11e1e;
  font-weight: 800;
  margin-left: 8rpx;
  display: inline-block;
  transform: translateY(1rpx);
}

.pills-row {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: nowrap;
  gap: 18rpx;
  overflow: hidden;
  flex: 1;
  min-height: 0;
  padding: 6rpx 0;
}

.pills-row.is-medium {
  gap: 14rpx;
}

.pills-row.is-dense {
  gap: 10rpx;
}

.pills-row.is-two-rows {
  flex-wrap: wrap;
  align-content: center;
  justify-content: center;
  gap: 10rpx 14rpx;
}

.pill-item {
  width: 148rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.pills-row.is-medium .pill-item {
  width: 132rpx;
}

.pills-row.is-dense .pill-item {
  width: 116rpx;
}

.pills-row.is-large .pill-item {
  width: 168rpx;
}

.pill-icon {
  width: 132rpx;
  height: 98rpx;
  margin-bottom: 8rpx;
  transform-origin: center center;
}
.pill-icon.is-scale-120 {
  transform: scale(1.2);
}

.pill-icon.is-scale-85 {
  transform: scale(0.85);
}

.pill-icon.is-scale-55 {
  transform: scale(0.55);
}

.pills-row.is-medium .pill-icon {
  width: 118rpx;
  height: 88rpx;
}

.pills-row.is-dense .pill-icon {
  width: 102rpx;
  height: 76rpx;
}

.pills-row.is-large .pill-icon {
  width: 148rpx;
  height: 110rpx;
}

.pill-name {
  margin-top: 2rpx;
  max-width: 100%;
  font-size: 20rpx;
  color: #68706f;
  line-height: 1.2;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pill-count {
  margin-top: 4rpx;
  font-size: 34rpx;
  color: #8a8d91;
  font-weight: 600;
  letter-spacing: 0.3rpx;
  line-height: 1;
}

.stage-indicators {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12rpx;
  margin: 8rpx 0 6rpx;
}

.indicator-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #d8dfdc;
  transition: all 0.2s ease;
}

.indicator-dot.is-complete {
  background: #9fddc2;
}

.indicator-dot.is-active {
  width: 40rpx;
  border-radius: 999rpx;
  background: linear-gradient(90deg, #18c889 0%, #2fe183 100%);
  box-shadow: 0 6rpx 12rpx rgba(27, 195, 130, 0.25);
}

.page-footer {
  padding-top: 30rpx;
  padding-bottom: 28rpx;
}

.take-btn {
  width: 100%;
  height: 106rpx;
  border-radius: 999rpx;
  border: none;
  background: linear-gradient(90deg, #16c995 0%, #2be67d 100%);
  color: #f3fff9;
  font-size: 70rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  box-shadow: 0 12rpx 22rpx rgba(18, 195, 141, 0.24);
  margin: 0 24rpx 26rpx;
}

.take-btn.is-disabled {
  background: #c4cbc8;
  color: #f2f4f3;
  box-shadow: none;
}

.take-btn::after {
  border: none;
}

.email-row {
  margin: 0 24rpx 6rpx;
}

.email-label {
  display: block;
  text-align: left;
  font-size: 22rpx;
  color: #8a9097;
  margin-bottom: 8rpx;
  font-weight: 400;
}

.email-input,
.email-saved {
  min-height: 64rpx;
  border-radius: 14rpx;
  padding: 10rpx 14rpx;
  font-size: 26rpx;
  color: #4e4e56;
  background: #ffffff;
  border: 2rpx solid #e1e8e5;
  box-sizing: border-box;
}

.email-saved {
  display: flex;
  align-items: center;
  line-height: 1.4;
}
</style>
