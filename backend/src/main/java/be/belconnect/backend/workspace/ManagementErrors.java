package be.belconnect.backend.workspace;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes={SpaceManagementController.class,GroupMembershipController.class,GroupRolesController.class,be.belconnect.backend.activity.ActivityManagementController.class})
public class ManagementErrors {
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Map<String,String>> status(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("message",e.getReason()==null?"La demande n’a pas pu être traitée.":e.getReason()));
    }
    @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class})
    ResponseEntity<Map<String,String>> invalid(Exception e) {
        return ResponseEntity.badRequest().body(Map.of("message","Vérifiez les champs obligatoires et les limites de longueur."));
    }
}
