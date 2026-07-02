import { Router } from "express";
import {
  createTopic,
  deleteTopic,
  getAppTopics,
  getCmsTopics,
  updateTopic,
  updateTopicSort,
} from "./topics.controller.js";

const topicsRouter = Router();
const cmsTopicsRouter = Router();

topicsRouter.get("/", getAppTopics);
cmsTopicsRouter.get("/", getCmsTopics);
cmsTopicsRouter.post("/", createTopic);
cmsTopicsRouter.put("/:id", updateTopic);
cmsTopicsRouter.delete("/:id", deleteTopic);
cmsTopicsRouter.patch("/sort", updateTopicSort);

export { topicsRouter, cmsTopicsRouter };
