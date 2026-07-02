import { Request, Response } from "express";
import { HomeServiceError, homeService } from "./home.service.js";

function handleHomeError(res: Response, error: unknown) {
  if (error instanceof HomeServiceError) {
    return res.status(error.status).json({
      success: false,
      error_code: error.code,
      message: error.message,
    });
  }
  console.error("[home-controller]", error);
  return res.status(500).json({
    success: false,
    error_code: "INTERNAL_ERROR",
    message: "服务器内部错误",
  });
}

function ok(res: Response, data: unknown, message = "ok", status = 200) {
  return res.status(status).json({
    success: true,
    data,
    message,
  });
}

export async function getCmsHomeBanners(_req: Request, res: Response) {
  try {
    return ok(res, { items: await homeService.getCmsBanners() });
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function postCmsHomeBanner(req: Request, res: Response) {
  try {
    return ok(res, { items: await homeService.createBanner(req.body || {}) }, "创建成功", 201);
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function putCmsHomeBanner(req: Request, res: Response) {
  try {
    return ok(
      res,
      { items: await homeService.updateBanner(req.params.id, req.body || {}) },
      "更新成功"
    );
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function deleteCmsHomeBanner(req: Request, res: Response) {
  try {
    return ok(res, await homeService.deleteBanner(req.params.id), "删除成功");
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function patchCmsHomeBannerSort(req: Request, res: Response) {
  try {
    return ok(res, await homeService.updateBannerSort(req.body || {}), "排序更新成功");
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function getCmsMostPopular(_req: Request, res: Response) {
  try {
    return ok(res, await homeService.getCmsSection("most_popular"));
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function putCmsMostPopular(req: Request, res: Response) {
  try {
    return ok(res, await homeService.upsertSection("most_popular", req.body || {}), "更新成功");
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function getCmsLatest(_req: Request, res: Response) {
  try {
    return ok(res, await homeService.getCmsSection("latest"));
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function putCmsLatest(req: Request, res: Response) {
  try {
    return ok(res, await homeService.upsertSection("latest", req.body || {}), "更新成功");
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function getCmsHomeCourses(_req: Request, res: Response) {
  try {
    return ok(res, { items: await homeService.getCmsCourses() });
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function postCmsHomeCourse(req: Request, res: Response) {
  try {
    return ok(res, { items: await homeService.createCourse(req.body || {}) }, "创建成功", 201);
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function putCmsHomeCourse(req: Request, res: Response) {
  try {
    return ok(
      res,
      { items: await homeService.updateCourse(req.params.id, req.body || {}) },
      "更新成功"
    );
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function deleteCmsHomeCourse(req: Request, res: Response) {
  try {
    return ok(res, await homeService.deleteCourse(req.params.id), "删除成功");
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function patchCmsHomeCourseSort(req: Request, res: Response) {
  try {
    return ok(res, await homeService.updateCourseSort(req.body || {}), "排序更新成功");
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function getCmsMembershipCta(_req: Request, res: Response) {
  try {
    return ok(res, await homeService.getCmsMembershipCta());
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function putCmsMembershipCta(req: Request, res: Response) {
  try {
    return ok(res, await homeService.upsertMembershipCta(req.body || {}), "更新成功");
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function getAppHomeBanners(_req: Request, res: Response) {
  try {
    return ok(res, { items: await homeService.getAppBanners() });
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function getAppMostPopular(_req: Request, res: Response) {
  try {
    return ok(res, await homeService.getAppSection("most_popular"));
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function getAppLatest(_req: Request, res: Response) {
  try {
    return ok(res, await homeService.getAppSection("latest"));
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function getAppHomeCourses(_req: Request, res: Response) {
  try {
    return ok(res, { items: await homeService.getAppCourses() });
  } catch (error) {
    return handleHomeError(res, error);
  }
}

export async function getAppMembershipCta(_req: Request, res: Response) {
  try {
    return ok(res, await homeService.getAppMembershipCta());
  } catch (error) {
    return handleHomeError(res, error);
  }
}
