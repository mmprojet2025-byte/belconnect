package be.belconnect.backend.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/auth/owner-mfa")
public class OwnerMfaController {
    private final OwnerMfaService service;
    private final OwnerSessionService sessions;
    public OwnerMfaController(OwnerMfaService service,OwnerSessionService sessions){this.service=service;this.sessions=sessions;}
    public record Begin(@NotBlank @Size(max=72) String password){}
    public record Code(@NotBlank @Size(max=80) String code,Boolean recovery){}
    private long owner(Authentication auth,HttpServletResponse response){response.setHeader("Cache-Control","no-store");Long id=service.ownerId(auth.getName());if(id==null)throw new ResponseStatusException(HttpStatus.FORBIDDEN);return id;}
    @GetMapping("/status")
    public OwnerMfaService.Status status(Authentication auth,HttpServletRequest request,HttpServletResponse response){
        response.setHeader("Cache-Control","no-store");Long id=service.ownerId(auth.getName());
        return id==null?new OwnerMfaService.Status(false,false,false):service.status(id,request.getSession(false));
    }
    @GetMapping("/events")
    public OwnerMfaService.Events events(Authentication auth,HttpServletRequest request,HttpServletResponse response,@RequestParam(required=false) Long before){
        return service.events(owner(auth,response),request.getSession(false),before);
    }
    @GetMapping("/actions")
    public OwnerMfaService.Actions actions(Authentication auth,HttpServletRequest request,HttpServletResponse response,@RequestParam(defaultValue="0") int page){
        return service.actions(owner(auth,response),request.getSession(false),page);
    }
    private long verifiedOwner(Authentication auth,HttpServletRequest request,HttpServletResponse response){
        long id=owner(auth,response);if(!service.status(id,request.getSession(false)).verified())throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Validez votre double authentification.");return id;
    }
    @GetMapping("/sessions")
    public List<OwnerSessionService.Session> sessions(Authentication auth,HttpServletRequest request,HttpServletResponse response){return sessions.list(verifiedOwner(auth,request,response),request.getSession(false));}
    @PostMapping("/sessions/revoke-others")
    public Map<String,Integer> revokeOthers(Authentication auth,HttpServletRequest request,HttpServletResponse response){return Map.of("revoked",sessions.revoke(verifiedOwner(auth,request,response),request.getSession(false),null));}
    @PostMapping("/sessions/{id}/revoke")
    public Map<String,Integer> revokeSession(Authentication auth,HttpServletRequest request,HttpServletResponse response,@PathVariable long id){return Map.of("revoked",sessions.revoke(verifiedOwner(auth,request,response),request.getSession(false),id));}
    @PostMapping("/begin")
    public Map<String,String> begin(Authentication auth,@Valid @RequestBody Begin body,HttpServletRequest request,HttpServletResponse response){
        long id=owner(auth,response);service.checkPassword(id,body.password());
        return Map.of("secret",service.begin(id,request.getSession()));
    }
    @PostMapping("/confirm")
    public Map<String,List<String>> confirm(Authentication auth,@Valid @RequestBody Code body,HttpServletRequest request,HttpServletResponse response){
        var codes=service.confirm(owner(auth,response),request.getSession(),body.code());request.changeSessionId();
        return Map.of("recoveryCodes",codes);
    }
    @PostMapping("/verify") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verify(Authentication auth,@Valid @RequestBody Code body,HttpServletRequest request,HttpServletResponse response){
        service.verify(owner(auth,response),request.getSession(),body.code(),Boolean.TRUE.equals(body.recovery()));request.changeSessionId();
    }
}
