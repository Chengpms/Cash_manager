package com.chengpms.gestordinero;

import android.app.Activity;
import android.app.PendingIntent;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.common.api.Scope;
import java.util.ArrayList;
import java.util.List;

/**
 * Autorización con Google para acceder a Google Sheets desde Android, usando
 * Google Identity Services (AuthorizationClient). Devuelve un token de acceso
 * de corta duración; cuando caduca se pide otro sin mostrar nada al usuario
 * (interactive=false) porque el permiso ya está concedido.
 *
 * Requiere un "ID de cliente de OAuth" de tipo Android en Google Cloud con el
 * nombre de paquete de la app y la huella SHA-1 de la clave de firma.
 */
@CapacitorPlugin(name = "GoogleAuth")
public class GoogleAuthPlugin extends Plugin {

    private ActivityResultLauncher<IntentSenderRequest> consentLauncher;
    private PluginCall pendingCall;

    @Override
    public void load() {
        // Debe registrarse mientras se crea la actividad
        consentLauncher = getActivity()
            .registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), this::onConsentResult);
    }

    @PluginMethod
    public void authorize(PluginCall call) {
        JSArray scopeArray = call.getArray("scopes");
        boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", true));
        List<Scope> scopes = new ArrayList<>();
        try {
            for (Object s : scopeArray.toList()) scopes.add(new Scope((String) s));
        } catch (Exception e) {
            call.reject("Permisos (scopes) no válidos", "INVALID_SCOPES");
            return;
        }
        if (scopes.isEmpty()) {
            call.reject("Permisos (scopes) no válidos", "INVALID_SCOPES");
            return;
        }

        AuthorizationRequest request = AuthorizationRequest.builder().setRequestedScopes(scopes).build();
        Identity.getAuthorizationClient(getActivity())
            .authorize(request)
            .addOnSuccessListener(result -> {
                if (!result.hasResolution()) {
                    resolveWith(call, result);
                    return;
                }
                // Hace falta que el usuario elija cuenta / acepte los permisos
                if (!interactive) {
                    call.reject("Hay que volver a dar permiso a Google", "NEEDS_CONSENT");
                    return;
                }
                PendingIntent intent = result.getPendingIntent();
                if (intent == null) {
                    call.reject("Google no pudo mostrar la pantalla de permisos", "NO_INTENT");
                    return;
                }
                if (pendingCall != null) pendingCall.reject("Se inició otro intento de conexión", "CANCELED");
                pendingCall = call;
                consentLauncher.launch(new IntentSenderRequest.Builder(intent.getIntentSender()).build());
            })
            .addOnFailureListener(e -> rejectWith(call, e));
    }

    private void onConsentResult(ActivityResult activityResult) {
        PluginCall call = pendingCall;
        pendingCall = null;
        if (call == null) return;
        if (activityResult.getResultCode() != Activity.RESULT_OK || activityResult.getData() == null) {
            call.reject("Has cancelado el acceso a Google", "CANCELED");
            return;
        }
        try {
            AuthorizationResult result = Identity.getAuthorizationClient(getActivity())
                .getAuthorizationResultFromIntent(activityResult.getData());
            resolveWith(call, result);
        } catch (ApiException e) {
            rejectWith(call, e);
        }
    }

    private void resolveWith(PluginCall call, AuthorizationResult result) {
        String token = result.getAccessToken();
        if (token == null) {
            call.reject("Google no devolvió un token de acceso", "NO_TOKEN");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("accessToken", token);
        call.resolve(ret);
    }

    private void rejectWith(PluginCall call, Exception e) {
        String code = "ERROR";
        if (e instanceof ApiException) {
            int status = ((ApiException) e).getStatusCode();
            code = status == CommonStatusCodes.DEVELOPER_ERROR ? "DEVELOPER_ERROR"
                : status == CommonStatusCodes.NETWORK_ERROR ? "NETWORK_ERROR"
                : status == CommonStatusCodes.CANCELED ? "CANCELED"
                : "STATUS_" + status;
        }
        String message = e.getMessage() != null ? e.getMessage() : "Error al conectar con Google";
        call.reject(message, code, e);
    }
}
