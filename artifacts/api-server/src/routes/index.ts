import { Router, type IRouter } from "express";
import healthRouter from "./health";
import askflowRouter from "./askflow";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(askflowRouter);
router.use(authRouter);

export default router;
