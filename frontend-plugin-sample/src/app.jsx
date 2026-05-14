import { WidgetOperationTypes } from "@openedx/frontend-base";
import CourseList from "./CourseList";

// A frontend-base App is a self-contained bundle of routes, slot operations,
// providers, and config.  This sample registers a single slot operation that
// replaces the learner-dashboard course list with our archive-aware version.
//
// Slot ID:           org.openedx.frontend.slot.learnerDashboard.courseList.v1
// Slot props:        courseListData (visibleList, course, courseRun, ...)
// Default widget id: defaultContent  (what the slot renders without any plugin)
//
// REPLACE swaps the default widget for ours; APPEND/PREPEND/INSERT_BEFORE/
// INSERT_AFTER would keep the default and add ours alongside it.
const app = {
  appId: "org.openedx.frontend.app.sample",
  slots: [
    {
      slotId: "org.openedx.frontend.slot.learnerDashboard.courseList.v1",
      id: "org.openedx.frontend.widget.sample.courseList.v1",
      op: WidgetOperationTypes.REPLACE,
      relatedId: "defaultContent",
      component: CourseList,
    },
  ],
};

export default app;
