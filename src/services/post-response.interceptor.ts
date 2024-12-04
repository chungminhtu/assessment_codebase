import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class PostResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    if (request.method === "POST") {
      const response = context.switchToHttp().getResponse();
      response.status(200);
    }
    return next.handle().pipe(
      map((data) => {
        return data;
      })
    );
  }
}
