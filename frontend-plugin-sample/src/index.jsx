import sampleApp from './app';
import CourseList from './CourseList';

// The default export is the frontend-base App.  Site operators wire it into
// their site.config.*.tsx with `addApp(siteConfig, sampleApp)`.
export default sampleApp;

// Named exports let consumers reach individual pieces (e.g., to render the
// CourseList directly, or to test slot operations in isolation).
export { sampleApp, CourseList };
