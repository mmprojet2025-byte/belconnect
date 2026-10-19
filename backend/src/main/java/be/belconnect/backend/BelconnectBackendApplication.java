package be.belconnect.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BelconnectBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(BelconnectBackendApplication.class, args);
	}

}
