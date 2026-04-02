<script>
export default {
  onLaunch() {
    // #ifdef MP-WEIXIN
    if (wx?.cloud?.init) {
      try {
        wx.cloud.init({
          env: 'cloud1-8gxk6av7dfc758c1',
          traceUser: true
        });
      } catch (error) {
        console.warn('[cloud init failed]', error);
      }
    }
    // #endif
  },
  onShow() {},
  onHide() {}
};
</script>

<style lang="scss">
@import "./uni.scss";
</style>
