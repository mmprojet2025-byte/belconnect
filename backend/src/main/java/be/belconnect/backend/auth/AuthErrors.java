package be.belconnect.backend.auth;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = {AuthController.class, MobileAuthController.class, OwnerMfaController.class, be.belconnect.backend.booking.BookingController.class})
public class AuthErrors {
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Map<String,String>> status(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode()).headers(exception.getHeaders()).body(Map.of("message",exception.getReason()==null?"La demande n’a pas pu être traitée.":exception.getReason()));
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String,String>> invalid(MethodArgumentNotValidException exception) {
        // Never serialize rejected values, particularly passwords.
        return ResponseEntity.badRequest().body(Map.of("message","Vérifiez les informations et les champs obligatoires."));
    }
}
