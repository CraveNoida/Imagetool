import { Router, type IRouter } from "express";
import healthRouter from "./health";
import imagesRouter from "./images";
import pdfRouter from "./pdf";
import resizeRouter from "./resize";

const router: IRouter = Router();

router.use(healthRouter);
router.use(imagesRouter);
router.use(pdfRouter);
router.use(resizeRouter);

export default router;
