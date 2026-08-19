import { Router, type IRouter } from "express";
import healthRouter from "./health";
import askflowRouter from "./askflow";

const router: IRouter = Router();

router.use(healthRouter);
router.use(askflowRouter);

export default router;
