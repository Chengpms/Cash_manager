package com.chengpms.gestordinero;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Los plugins propios de la app se registran antes de crear el puente
        registerPlugin(GoogleAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
