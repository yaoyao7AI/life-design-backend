import { Router } from "express";
import {
  deleteCmsHomeBanner,
  deleteCmsHomeCourse,
  getAppHomeBanners,
  getAppHomeCourses,
  getAppLatest,
  getAppMembershipCta,
  getAppMostPopular,
  getCmsHomeBanners,
  getCmsHomeCourses,
  getCmsLatest,
  getCmsMembershipCta,
  getCmsMostPopular,
  patchCmsHomeBannerSort,
  patchCmsHomeCourseSort,
  postCmsHomeBanner,
  postCmsHomeCourse,
  putCmsHomeBanner,
  putCmsHomeCourse,
  putCmsLatest,
  putCmsMembershipCta,
  putCmsMostPopular,
} from "./home.controller.js";

const homeRouter = Router();
const cmsHomeRouter = Router();

cmsHomeRouter.get("/banners", getCmsHomeBanners);
cmsHomeRouter.post("/banners", postCmsHomeBanner);
cmsHomeRouter.put("/banners/:id", putCmsHomeBanner);
cmsHomeRouter.delete("/banners/:id", deleteCmsHomeBanner);
cmsHomeRouter.patch("/banners/sort", patchCmsHomeBannerSort);

cmsHomeRouter.get("/most-popular", getCmsMostPopular);
cmsHomeRouter.put("/most-popular", putCmsMostPopular);

cmsHomeRouter.get("/latest", getCmsLatest);
cmsHomeRouter.put("/latest", putCmsLatest);

cmsHomeRouter.get("/courses", getCmsHomeCourses);
cmsHomeRouter.post("/courses", postCmsHomeCourse);
cmsHomeRouter.put("/courses/:id", putCmsHomeCourse);
cmsHomeRouter.delete("/courses/:id", deleteCmsHomeCourse);
cmsHomeRouter.patch("/courses/sort", patchCmsHomeCourseSort);

cmsHomeRouter.get("/membership-cta", getCmsMembershipCta);
cmsHomeRouter.put("/membership-cta", putCmsMembershipCta);

homeRouter.get("/banners", getAppHomeBanners);
homeRouter.get("/most-popular", getAppMostPopular);
homeRouter.get("/latest", getAppLatest);
homeRouter.get("/courses", getAppHomeCourses);
homeRouter.get("/membership-cta", getAppMembershipCta);

export { homeRouter, cmsHomeRouter };
