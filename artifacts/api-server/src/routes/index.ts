import { Router, type IRouter } from "express";
import adminSessionRouter from "./admin-session";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminSessionRouter);

export default router;
